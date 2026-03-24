import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockFindUnique = vi.fn()
const mockUpdateMany = vi.fn()
const mockVerifyPayment = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

vi.mock("@/lib/payment", () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
}))

import { POST } from "@/app/api/payment/verify/route"

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payment/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/payment/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 if orderId is missing", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 if orderId is not a string", async () => {
    const res = await POST(makeRequest({ orderId: 123 }))
    expect(res.status).toBe(400)
  })

  it("returns 404 if order not found", async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(404)
  })

  it("returns { status: 'paid' } immediately if already paid", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: "pi_123",
      paymentStatus: "paid",
      paymentMethod: "stripe",
    })

    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("paid")
    expect(mockVerifyPayment).not.toHaveBeenCalled()
  })

  it("returns 400 if order has no paymentIntentId", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: null,
      paymentStatus: "pending",
      paymentMethod: "cash",
    })

    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Keine Zahlung")
  })

  it("updates DB and returns paid when verifyPayment returns 'paid'", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: "pi_123",
      paymentStatus: "pending",
      paymentMethod: "stripe",
    })
    mockVerifyPayment.mockResolvedValue("paid")

    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("paid")

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "paid",
        paidAt: expect.any(Date),
      },
    })
  })

  it("returns pending without DB update when verifyPayment returns 'pending'", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: "pi_123",
      paymentStatus: "pending",
      paymentMethod: "stripe",
    })
    mockVerifyPayment.mockResolvedValue("pending")

    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("pending")
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it("updates DB and returns failed when verifyPayment returns 'failed'", async () => {
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: "pi_123",
      paymentStatus: "pending",
      paymentMethod: "stripe",
    })
    mockVerifyPayment.mockResolvedValue("failed")

    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("failed")

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "failed",
      },
    })
  })

  it("does not overwrite paid status (idempotency guard)", async () => {
    // The idempotency is enforced by the where clause { paymentStatus: { not: "paid" } }
    // If the order is already paid, the short-circuit prevents any update
    mockFindUnique.mockResolvedValue({
      id: "order-1",
      paymentIntentId: "pi_123",
      paymentStatus: "paid",
      paymentMethod: "stripe",
    })

    const res = await POST(makeRequest({ orderId: "order-1" }))
    const json = await res.json()
    expect(json.status).toBe("paid")
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockVerifyPayment).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected DB error", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB timeout"))
    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(500)
  })
})
