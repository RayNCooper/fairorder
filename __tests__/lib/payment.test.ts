import { describe, it, expect, vi, beforeEach } from "vitest"

describe("payment — cash provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "cash")
  })

  it("createPaymentIntent returns success with cash transaction ID", async () => {
    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 1000,
      currency: "eur",
      orderId: "order-1",
      customerName: "Max",
    })
    expect(result.success).toBe(true)
    expect(result.transactionId).toBe("cash_order-1")
    expect(result.clientSecret).toBeUndefined()
  })

  it("verifyPayment returns 'paid' for cash", async () => {
    const { verifyPayment } = await import("@/lib/payment")
    const result = await verifyPayment("cash_order-1")
    expect(result).toBe("paid")
  })

  it("isStripeEnabled returns false for cash provider", async () => {
    const { isStripeEnabled } = await import("@/lib/payment")
    expect(isStripeEnabled()).toBe(false)
  })
})

describe("payment — stripe provider", () => {
  const mockCreate = vi.fn()
  const mockRetrieve = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "stripe")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx")
    mockCreate.mockReset()
    mockRetrieve.mockReset()

    vi.doMock("stripe", () => ({
      default: class MockStripe {
        paymentIntents = {
          create: mockCreate,
          retrieve: mockRetrieve,
        }
      },
    }))
  })

  it("createPaymentIntent calls Stripe and returns clientSecret", async () => {
    mockCreate.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret",
    })

    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 1500,
      currency: "eur",
      orderId: "order-2",
      customerName: "Lisa",
    })

    expect(result.success).toBe(true)
    expect(result.transactionId).toBe("pi_123")
    expect(result.clientSecret).toBe("pi_123_secret")
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1500,
        currency: "eur",
        metadata: expect.objectContaining({ orderId: "order-2" }),
      })
    )
  })

  it("createPaymentIntent returns error on Stripe failure", async () => {
    mockCreate.mockRejectedValue(new Error("Card declined"))

    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 1500,
      currency: "eur",
      orderId: "order-3",
      customerName: "Test",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Card declined")
  })

  it("verifyPayment returns 'paid' for succeeded status", async () => {
    mockRetrieve.mockResolvedValue({ status: "succeeded" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_123")).toBe("paid")
  })

  it("verifyPayment returns 'failed' for requires_payment_method", async () => {
    mockRetrieve.mockResolvedValue({ status: "requires_payment_method" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_456")).toBe("failed")
  })

  it("verifyPayment returns 'failed' for canceled status", async () => {
    mockRetrieve.mockResolvedValue({ status: "canceled" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_789")).toBe("failed")
  })

  it("verifyPayment returns 'pending' for processing status", async () => {
    mockRetrieve.mockResolvedValue({ status: "processing" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_proc")).toBe("pending")
  })

  it("verifyPayment returns 'pending' for requires_action status", async () => {
    mockRetrieve.mockResolvedValue({ status: "requires_action" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_action")).toBe("pending")
  })

  it("isStripeEnabled returns true when stripe provider + key set", async () => {
    const { isStripeEnabled } = await import("@/lib/payment")
    expect(isStripeEnabled()).toBe(true)
  })
})

describe("payment — stripe provider edge cases", () => {
  const mockCreate = vi.fn()
  const mockRetrieve = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "stripe")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx")
    mockCreate.mockReset()
    mockRetrieve.mockReset()

    vi.doMock("stripe", () => ({
      default: class MockStripe {
        paymentIntents = {
          create: mockCreate,
          retrieve: mockRetrieve,
        }
      },
    }))
  })

  it("handles null client_secret from Stripe (edge case)", async () => {
    mockCreate.mockResolvedValue({
      id: "pi_null_secret",
      client_secret: null,
    })

    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 500,
      currency: "eur",
      orderId: "order-null",
      customerName: "Test",
    })

    expect(result.success).toBe(true)
    expect(result.clientSecret).toBeUndefined()
  })

  it("verifyPayment returns 'pending' on Stripe API error", async () => {
    mockRetrieve.mockRejectedValue(new Error("Network error"))

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_broken")).toBe("pending")
  })

  it("passes custom metadata through to Stripe", async () => {
    mockCreate.mockResolvedValue({ id: "pi_meta", client_secret: "s" })

    const { createPaymentIntent } = await import("@/lib/payment")
    await createPaymentIntent({
      amount: 100,
      currency: "eur",
      orderId: "order-meta",
      customerName: "Meta",
      metadata: { tableNumber: "5" },
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderId: "order-meta",
          tableNumber: "5",
        }),
      })
    )
  })

  it("returns non-Error exception message as generic fallback", async () => {
    mockCreate.mockRejectedValue("string error")

    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 100,
      currency: "eur",
      orderId: "x",
      customerName: "x",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Zahlungsdienst nicht erreichbar.")
  })
})

describe("payment — default provider (no env var)", () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.PAYMENT_PROVIDER
  })

  it("defaults to cash when PAYMENT_PROVIDER is not set", async () => {
    const { createPaymentIntent } = await import("@/lib/payment")
    const result = await createPaymentIntent({
      amount: 100,
      currency: "eur",
      orderId: "order-default",
      customerName: "Default",
    })
    expect(result.success).toBe(true)
    expect(result.transactionId).toBe("cash_order-default")
  })

  it("isStripeEnabled returns false when no provider set", async () => {
    const { isStripeEnabled } = await import("@/lib/payment")
    expect(isStripeEnabled()).toBe(false)
  })
})

describe("payment — verifyPayment unknown provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "unknown-provider")
  })

  it("returns 'failed' for unknown provider", async () => {
    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("txn_123")).toBe("failed")
  })
})

describe("payment — missing STRIPE_SECRET_KEY", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "stripe")
    delete process.env.STRIPE_SECRET_KEY

    vi.doMock("stripe", () => ({
      default: class MockStripe {
        constructor() {
          // This shouldn't be reached if key validation works
        }
      },
    }))
  })

  it("returns error when STRIPE_SECRET_KEY missing", async () => {
    const { createPaymentIntent } = await import("@/lib/payment")
    // The stripe provider catches the error and returns { success: false }
    const result = await createPaymentIntent({
      amount: 100,
      currency: "eur",
      orderId: "x",
      customerName: "x",
    })
    // getStripeClient throws but createStripeIntent catches it
    expect(result.success).toBe(false)
    expect(result.error).toContain("STRIPE_SECRET_KEY")
  })
})

describe("payment — unknown provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("PAYMENT_PROVIDER", "paypal")
  })

  it("throws for unknown provider", async () => {
    const { createPaymentIntent } = await import("@/lib/payment")
    await expect(
      createPaymentIntent({
        amount: 100,
        currency: "eur",
        orderId: "x",
        customerName: "x",
      })
    ).rejects.toThrow("Unknown PAYMENT_PROVIDER")
  })
})
