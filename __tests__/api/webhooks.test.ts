import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockUpdateMany = vi.fn()
const mockConstructEvent = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

vi.mock("stripe", () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    }
  },
}))

import { POST } from "@/app/api/webhooks/stripe/route"

function makeRequest(body: string, signature?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (signature) headers["stripe-signature"] = signature

  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  })
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx")
  })

  it("returns 503 if STRIPE_WEBHOOK_SECRET not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest("{}", "sig_123"))
    expect(res.status).toBe(503)
  })

  it("returns 400 if signature header missing", async () => {
    const res = await POST(makeRequest("{}"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Missing signature")
  })

  it("returns 400 if signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature")
    })

    const res = await POST(makeRequest("{}", "bad_sig"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Invalid signature")
  })

  it("handles payment_intent.succeeded event", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123" } },
    })

    const res = await POST(makeRequest("{}", "sig_valid"))
    expect(res.status).toBe(200)

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        paymentIntentId: "pi_123",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "paid",
        paidAt: expect.any(Date),
      },
    })
  })

  it("handles payment_intent.payment_failed event", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_456" } },
    })

    const res = await POST(makeRequest("{}", "sig_valid"))
    expect(res.status).toBe(200)

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        paymentIntentId: "pi_456",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "failed",
      },
    })
  })

  it("does not overwrite paid status on payment_failed event", async () => {
    // This tests the idempotency guard: if a payment was already confirmed
    // as paid, a subsequent failure event should not downgrade the status.
    // The where clause uses { not: "paid" } to prevent this.
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_paid" } },
    })

    const res = await POST(makeRequest("{}", "sig_valid"))
    expect(res.status).toBe(200)

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        paymentIntentId: "pi_paid",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "failed",
      },
    })
  })

  it("returns 200 even when DB update throws (prevents Stripe retries)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_err" } },
    })
    mockUpdateMany.mockRejectedValue(new Error("DB timeout"))

    const res = await POST(makeRequest("{}", "sig_valid"))
    // Should still return 200 to prevent Stripe from retrying
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })

  it("acknowledges unknown event types without updating orders", async () => {
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: {} },
    })

    const res = await POST(makeRequest("{}", "sig_valid"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})
