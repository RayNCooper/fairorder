import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockCapturePayPalPayment = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/payment", () => ({
  capturePayPalPayment: (...args: unknown[]) => mockCapturePayPalPayment(...args),
}))

import { POST } from "@/app/api/payment/capture/route"
import { db } from "@/lib/db"

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payment/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const mockOrder = {
  id: "order-1",
  paymentIntentId: "PAYPAL-ORDER-123",
  paymentStatus: "pending",
  paymentMethod: "paypal",
}

describe("POST /api/payment/capture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 if orderId missing", async () => {
    const res = await POST(makeRequest({ paypalOrderId: "x" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 if paypalOrderId missing", async () => {
    const res = await POST(makeRequest({ orderId: "x" }))
    expect(res.status).toBe(400)
  })

  it("returns 404 if order not found", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null as never)
    const res = await POST(makeRequest({ orderId: "x", paypalOrderId: "y" }))
    expect(res.status).toBe(404)
  })

  it("returns 403 if paymentMethod is not paypal", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...mockOrder,
      paymentMethod: "stripe",
    } as never)
    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    expect(res.status).toBe(403)
  })

  it("returns 403 if paypalOrderId does not match stored paymentIntentId", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "WRONG-ID" }))
    expect(res.status).toBe(403)
  })

  it("returns paid without re-capturing if already paid", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...mockOrder,
      paymentStatus: "paid",
    } as never)
    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("paid")
    expect(mockCapturePayPalPayment).not.toHaveBeenCalled()
  })

  it("returns paid on successful capture", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    mockCapturePayPalPayment.mockResolvedValue("paid")
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never)

    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("paid")

    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", paymentStatus: { not: "paid" } },
      data: { paymentStatus: "paid", paidAt: expect.any(Date) },
    })
  })

  it("returns failed on capture failure", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    mockCapturePayPalPayment.mockResolvedValue("failed")
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never)

    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    const json = await res.json()
    expect(json.status).toBe("failed")
  })

  it("returns pending on compliance hold", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    mockCapturePayPalPayment.mockResolvedValue("pending")

    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    const json = await res.json()
    expect(json.status).toBe("pending")
    // Should NOT update DB for pending — cron sweep handles it
    expect(db.order.updateMany).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected error", async () => {
    vi.mocked(db.order.findUnique).mockRejectedValue(new Error("DB down"))
    const res = await POST(makeRequest({ orderId: "order-1", paypalOrderId: "PAYPAL-ORDER-123" }))
    expect(res.status).toBe(500)
  })
})
