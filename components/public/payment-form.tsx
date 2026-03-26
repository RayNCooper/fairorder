"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";

// Lazy-load Stripe.js only when needed
let stripePromise: Promise<import("@stripe/stripe-js").Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    // Dynamic import to avoid loading stripe-js when not using Stripe
    stripePromise = import("@stripe/stripe-js").then((mod) =>
      mod.loadStripe(key)
    );
  }
  return stripePromise;
}

interface PaymentFormProps {
  clientSecret: string;
  amount: number; // cents
  orderId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function StripePaymentForm({
  clientSecret,
  amount,
  orderId,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const [stripe, setStripe] = useState<import("@stripe/stripe-js").Stripe | null>(null);
  const [elements, setElements] = useState<import("@stripe/stripe-js").StripeElements | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const p = getStripe();
    if (!p) {
      onErrorRef.current("Stripe ist nicht konfiguriert.");
      return;
    }
    p.then((s) => {
      if (!s) {
        onErrorRef.current("Stripe konnte nicht geladen werden.");
        return;
      }
      setStripe(s);
      const el = s.elements({
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            borderRadius: "0px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            colorPrimary: "#16A34A",
          },
        },
      });
      setElements(el);
    });
  }, [clientSecret]);

  useEffect(() => {
    if (!elements) return;
    const paymentElement = elements.create("payment");
    paymentElement.mount("#stripe-payment-element");
    paymentElement.on("ready", () => setReady(true));
    return () => paymentElement.unmount();
  }, [elements]);

  async function pollPaymentStatus() {
    setConfirming(true);
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const res = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid") {
            setConfirming(false);
            onSuccess();
            return;
          }
          if (data.status === "failed") {
            setConfirming(false);
            onError("Zahlung fehlgeschlagen.");
            return;
          }
        }
      } catch {
        // Network error — retry
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setConfirming(false);
    onError("Zahlung konnte nicht bestätigt werden. Bitte prüfe deine Bestellung.");
  }

  async function handleSubmit() {
    if (!stripe || !elements) return;
    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Zahlung fehlgeschlagen.");
      setProcessing(false);
    } else {
      setProcessing(false);
      pollPaymentStatus();
    }
  }

  return (
    <div className="space-y-4">
      <div id="stripe-payment-element" className="min-h-[120px]" />
      {ready && (
        <button
          className="flex w-full items-center justify-between bg-green-600 px-4 py-3 text-white hover:bg-green-500 disabled:opacity-50"
          disabled={processing || confirming || !stripe}
          onClick={handleSubmit}
        >
          <span className="text-sm font-bold">
            {confirming
              ? "Zahlung wird bestätigt..."
              : processing
                ? "Wird verarbeitet..."
                : "Jetzt bezahlen"}
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {(amount / 100).toFixed(2).replace(".", ",")}&nbsp;&euro;
          </span>
        </button>
      )}
    </div>
  );
}

// ── PayPal payment form ──

interface PayPalPaymentFormProps {
  locationId: string;
  orderId: string;
  amount: number; // cents
  onSuccess: () => void;
  onError: (message: string) => void;
  onPending: () => void;
}

function PayPalButtonsWrapper({
  locationId,
  orderId,
  onSuccess,
  onError,
  onPending,
}: PayPalPaymentFormProps) {
  const [{ isPending }] = usePayPalScriptReducer();
  const [processing, setProcessing] = useState(false);

  const createOrder = useCallback(async () => {
    const res = await fetch("/api/payment/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, orderId, method: "paypal" }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "PayPal-Bestellung konnte nicht erstellt werden.");
    }

    const { paypalOrderId } = await res.json();

    // Persist for mobile redirect recovery
    try {
      sessionStorage.setItem(
        "fairorder_paypal_pending",
        JSON.stringify({ orderId, paypalOrderId, locationId })
      );
    } catch {
      // sessionStorage unavailable — continue without persistence
    }

    return paypalOrderId;
  }, [locationId, orderId]);

  const onApprove = useCallback(
    async (data: { orderID: string }) => {
      setProcessing(true);
      try {
        const res = await fetch("/api/payment/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            paypalOrderId: data.orderID,
          }),
        });

        if (!res.ok) {
          // Retry once on network failure
          const retryRes = await fetch("/api/payment/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              paypalOrderId: data.orderID,
            }),
          });

          if (!retryRes.ok) {
            onPending();
            return;
          }

          const retryResult = await retryRes.json();
          if (retryResult.status === "paid") {
            clearPayPalPending();
            onSuccess();
          } else if (retryResult.status === "pending") {
            onPending();
          } else {
            onError("PayPal-Zahlung fehlgeschlagen.");
          }
          return;
        }

        const result = await res.json();
        if (result.status === "paid") {
          clearPayPalPending();
          onSuccess();
        } else if (result.status === "pending") {
          onPending();
        } else {
          onError("PayPal-Zahlung fehlgeschlagen.");
        }
      } catch {
        // Network error after approval — show pending state
        onPending();
      } finally {
        setProcessing(false);
      }
    },
    [orderId, onSuccess, onError, onPending]
  );

  if (isPending || processing) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <p className="text-sm text-stone-500">
          {processing ? "PayPal-Zahlung wird verarbeitet..." : "PayPal wird geladen..."}
        </p>
      </div>
    );
  }

  return (
    <PayPalButtons
      style={{ layout: "vertical", shape: "rect", label: "pay" }}
      createOrder={createOrder}
      onApprove={onApprove}
      onCancel={() => {
        // Guest cancelled — reset UI, don't mark as failed
        clearPayPalPending();
      }}
      onError={() => {
        onError("PayPal-Zahlung fehlgeschlagen. Bitte versuche es erneut.");
      }}
    />
  );
}

function clearPayPalPending() {
  try {
    sessionStorage.removeItem("fairorder_paypal_pending");
  } catch {
    // sessionStorage unavailable
  }
}

export function getPayPalPendingRecovery(): {
  orderId: string;
  paypalOrderId: string;
  locationId: string;
} | null {
  try {
    const raw = sessionStorage.getItem("fairorder_paypal_pending");
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.orderId && data.paypalOrderId && data.locationId) return data;
    return null;
  } catch {
    return null;
  }
}

export function PayPalPaymentForm(props: PayPalPaymentFormProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="border-l-3 border-red-500 bg-red-50 p-3">
        <p className="text-sm text-red-700">PayPal ist nicht konfiguriert.</p>
      </div>
    );
  }

  return (
    // CSP note: PayPal JS SDK loads from https://www.paypal.com
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "EUR",
        intent: "capture",
      }}
    >
      <PayPalButtonsWrapper {...props} />
    </PayPalScriptProvider>
  );
}

// ── Payment method selector ──

export type PaymentMethod = "cash" | "stripe" | "paypal";

interface PaymentMethodSelectorProps {
  acceptedPayments: string[];
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

function PaymentOptionButton({
  method,
  selected,
  onSelect,
  label,
  description,
}: {
  method: PaymentMethod;
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  label: string;
  description: string;
}) {
  const isSelected = selected === method;
  return (
    <button
      className={
        isSelected
          ? "flex w-full items-center gap-3 border-2 border-stone-900 bg-white p-3 text-left"
          : "flex w-full items-center gap-3 border border-stone-300 bg-white p-3 text-left hover:border-stone-400"
      }
      onClick={() => onSelect(method)}
    >
      <span
        className={
          isSelected
            ? "flex h-5 w-5 items-center justify-center border-2 border-stone-900"
            : "flex h-5 w-5 items-center justify-center border border-stone-400"
        }
      >
        {isSelected && <span className="h-3 w-3 bg-stone-900" />}
      </span>
      <div>
        <p className="text-sm font-bold text-stone-900">{label}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
    </button>
  );
}

export function PaymentMethodSelector({
  acceptedPayments,
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  const hasStripe = acceptedPayments.includes("stripe");
  const hasCash = acceptedPayments.includes("cash");
  const hasPayPal = acceptedPayments.includes("paypal");

  // Only one method available — no selector needed
  const methodCount = [hasCash, hasStripe, hasPayPal].filter(Boolean).length;
  if (methodCount <= 1) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-stone-700">Bezahlart</p>
      <div className="space-y-2">
        {hasCash && (
          <PaymentOptionButton
            method="cash"
            selected={selected}
            onSelect={onSelect}
            label="Barzahlung an der Kasse"
            description="Bezahle bei Abholung"
          />
        )}
        {hasStripe && (
          <PaymentOptionButton
            method="stripe"
            selected={selected}
            onSelect={onSelect}
            label="Vorauszahlung (Karte)"
            description="Jetzt online bezahlen"
          />
        )}
        {hasPayPal && (
          <PaymentOptionButton
            method="paypal"
            selected={selected}
            onSelect={onSelect}
            label="PayPal"
            description="Jetzt mit PayPal bezahlen"
          />
        )}
      </div>
    </div>
  );
}
