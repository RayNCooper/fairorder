// ── Payment Provider Abstraction ──
// Supports 3 providers, auto-detected from API keys:
//   "stripe" — Stripe payment processing (also supports PayPal via automatic_payment_methods)
//   "paypal" — Native PayPal payment processing
//   "cash"   — Cash at till (default, no-op)

export type PaymentMethod = "cash" | "stripe" | "paypal";

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  clientSecret?: string;
  paypalOrderId?: string;
  error?: string;
}

export interface CreatePaymentIntentOptions {
  amount: number; // cents
  currency: string; // "eur"
  orderId: string;
  customerName: string;
  metadata?: Record<string, string>;
}

export type PaymentVerifyStatus = "paid" | "pending" | "failed";

export type CaptureStatus = "paid" | "pending" | "failed";

/** Convert cents to decimal string for PayPal (e.g., 1250 → "12.50") */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ── Cash provider ──

function createCashIntent(options: CreatePaymentIntentOptions): PaymentResult {
  return {
    success: true,
    transactionId: `cash_${options.orderId}`,
  };
}

function verifyCashPayment(): PaymentVerifyStatus {
  return "paid";
}

// ── Stripe provider ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _stripe: any = null;

async function getStripeClient() {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is required for Stripe payments. Set it in your .env file."
    );
  }

  const { default: Stripe } = await import("stripe");
  _stripe = new Stripe(secretKey);
  return _stripe;
}

async function createStripeIntent(
  options: CreatePaymentIntentOptions
): Promise<PaymentResult> {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: options.amount,
      currency: options.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: options.orderId,
        customerName: options.customerName,
        ...options.metadata,
      },
    });

    return {
      success: true,
      transactionId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
    };
  } catch (error) {
    console.error("Failed to create Stripe PaymentIntent:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Zahlungsdienst nicht erreichbar.",
    };
  }
}

async function verifyStripePayment(
  transactionId: string
): Promise<PaymentVerifyStatus> {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);

    switch (paymentIntent.status) {
      case "succeeded":
        return "paid";
      case "canceled":
      case "requires_payment_method":
        return "failed";
      default:
        // processing, requires_action, requires_confirmation, etc.
        return "pending";
    }
  } catch (error) {
    console.error("Failed to verify Stripe payment:", error);
    return "pending";
  }
}

/** Retrieve an existing Stripe PaymentIntent by ID. Returns client_secret or null. */
export async function retrieveStripePaymentIntent(
  paymentIntentId: string
): Promise<{ clientSecret: string; transactionId: string } | null> {
  try {
    const stripe = await getStripeClient();
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (existing.client_secret) {
      return { clientSecret: existing.client_secret, transactionId: existing.id };
    }
    return null;
  } catch {
    return null;
  }
}

// ── PayPal provider ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _paypalOrdersController: any = null;

async function getPayPalOrdersController() {
  if (_paypalOrdersController) return _paypalOrdersController;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required for PayPal payments. " +
        "Set them in your .env file."
    );
  }

  const { Client, Environment, OrdersController } = await import(
    "@paypal/paypal-server-sdk"
  );

  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment:
      process.env.NODE_ENV === "production"
        ? Environment.Production
        : Environment.Sandbox,
  });

  _paypalOrdersController = new OrdersController(client);
  return _paypalOrdersController;
}

async function createPayPalOrder(
  options: CreatePaymentIntentOptions
): Promise<PaymentResult> {
  try {
    const ordersController = await getPayPalOrdersController();
    const { CheckoutPaymentIntent } = await import(
      "@paypal/paypal-server-sdk"
    );

    const { result } = await ordersController.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            amount: {
              currencyCode: options.currency.toUpperCase(),
              value: centsToDecimal(options.amount),
            },
            referenceId: options.orderId,
            description: `FairOrder Bestellung`,
          },
        ],
      },
      prefer: "return=representation",
    });

    return {
      success: true,
      transactionId: result.id,
      paypalOrderId: result.id,
    };
  } catch (error) {
    console.error("Failed to create PayPal order:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "PayPal-Dienst nicht erreichbar.",
    };
  }
}

export async function capturePayPalPayment(
  paypalOrderId: string
): Promise<CaptureStatus> {
  try {
    const ordersController = await getPayPalOrdersController();
    const { result } = await ordersController.captureOrder({
      id: paypalOrderId,
    });

    if (result.status === "COMPLETED") {
      return "paid";
    }
    // PayPal can return PENDING for compliance/risk holds
    return "pending";
  } catch (error: unknown) {
    // Handle ORDER_ALREADY_CAPTURED — treat as success
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("ORDER_ALREADY_CAPTURED")) {
      return "paid";
    }
    console.error("Failed to capture PayPal payment:", error);
    return "failed";
  }
}

async function verifyPayPalPayment(
  transactionId: string
): Promise<PaymentVerifyStatus> {
  try {
    const ordersController = await getPayPalOrdersController();
    const { result } = await ordersController.getOrder({
      id: transactionId,
    });

    switch (result.status) {
      case "COMPLETED":
        return "paid";
      case "VOIDED":
        return "failed";
      default:
        // CREATED, APPROVED, PAYER_ACTION_REQUIRED, etc.
        return "pending";
    }
  } catch (error) {
    console.error("Failed to verify PayPal payment:", error);
    return "pending";
  }
}

// ── Public API ──

/** @deprecated Use auto-detection instead. Honored as fallback when method param is omitted. */
function getLegacyProvider(): PaymentMethod {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider) {
    if (provider !== "stripe" && provider !== "cash" && provider !== "paypal") {
      console.warn(
        `Unknown PAYMENT_PROVIDER: "${provider}". Falling back to "cash".`
      );
      return "cash";
    }
    console.warn(
      "PAYMENT_PROVIDER env var is deprecated. " +
        "Providers are now auto-detected from API keys. " +
        "Use per-location acceptedPayments to control which methods are offered."
    );
    return provider;
  }
  return "cash";
}

export async function createPaymentIntent(
  options: CreatePaymentIntentOptions,
  method?: PaymentMethod
): Promise<PaymentResult> {
  const provider = method ?? getLegacyProvider();

  switch (provider) {
    case "stripe":
      return createStripeIntent(options);
    case "paypal":
      return createPayPalOrder(options);
    case "cash":
      return createCashIntent(options);
    default:
      throw new Error(
        `Unknown payment method: "${provider}". Use "stripe", "paypal", or "cash".`
      );
  }
}

export async function verifyPayment(
  transactionId: string,
  method?: PaymentMethod
): Promise<PaymentVerifyStatus> {
  const provider = method ?? getLegacyProvider();

  switch (provider) {
    case "stripe":
      return verifyStripePayment(transactionId);
    case "paypal":
      return verifyPayPalPayment(transactionId);
    case "cash":
      return verifyCashPayment();
    default:
      return "failed";
  }
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isPayPalEnabled(): boolean {
  return !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;
}
