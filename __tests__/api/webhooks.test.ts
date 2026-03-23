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

  it("returns 500 if STRIPE_WEBHOOK_SECRET not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest("{}", "sig_123"))
    expect(res.status).toBe(500)
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
