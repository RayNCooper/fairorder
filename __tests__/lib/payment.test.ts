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

  it("verifyPayment always returns true for cash", async () => {
    const { verifyPayment } = await import("@/lib/payment")
    const result = await verifyPayment("cash_order-1")
    expect(result).toBe(true)
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

  it("verifyPayment checks payment intent status", async () => {
    mockRetrieve.mockResolvedValue({ status: "succeeded" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_123")).toBe(true)
  })

  it("verifyPayment returns false for non-succeeded status", async () => {
    mockRetrieve.mockResolvedValue({ status: "requires_payment_method" })

    const { verifyPayment } = await import("@/lib/payment")
    expect(await verifyPayment("pi_456")).toBe(false)
  })

  it("isStripeEnabled returns true when stripe provider + key set", async () => {
    const { isStripeEnabled } = await import("@/lib/payment")
    expect(isStripeEnabled()).toBe(true)
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
