import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    location: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/payment", () => ({
  createPaymentIntent: vi.fn(),
}))

import { POST } from "@/app/api/payment/create-intent/route"
import { db } from "@/lib/db"
import { createPaymentIntent } from "@/lib/payment"

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payment/create-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  locationId: "loc-1",
  orderId: "order-1",
}

const mockOrder = {
  id: "order-1",
  locationId: "loc-1",
  customerName: "Max",
  paymentStatus: "pending",
  items: [
    { unitPrice: 8.5, quantity: 2 },  // 1700 cents
    { unitPrice: 3.0, quantity: 1 },   // 300 cents
  ],
}

describe("POST /api/payment/create-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 if locationId missing", async () => {
    const res = await POST(makeRequest({ orderId: "order-1" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 if orderId missing", async () => {
    const res = await POST(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(400)
  })

  it("returns 404 if location not found", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(null as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it("returns 403 if payment not enabled", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: false,
      acceptedPayments: [],
    } as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 403 if stripe not in accepted payments", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["cash"],
    } as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 404 if order not found", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(null as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it("returns 404 if order belongs to different location", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...mockOrder,
      locationId: "loc-OTHER",
    } as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it("returns 400 if order already paid", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...mockOrder,
      paymentStatus: "paid",
    } as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("bereits bezahlt")
  })

  it("computes amount server-side from order items", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    vi.mocked(createPaymentIntent).mockResolvedValue({
      success: true,
      transactionId: "pi_123",
      clientSecret: "pi_123_secret",
    })
    vi.mocked(db.order.update).mockResolvedValue({} as never)

    await POST(makeRequest(validBody))

    // 8.50 * 2 = 1700 cents + 3.00 * 1 = 300 cents = 2000 cents
    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000 })
    )
  })

  it("returns clientSecret on success", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    vi.mocked(createPaymentIntent).mockResolvedValue({
      success: true,
      transactionId: "pi_123",
      clientSecret: "pi_123_secret",
    })
    vi.mocked(db.order.update).mockResolvedValue({} as never)

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clientSecret).toBe("pi_123_secret")
    expect(json.transactionId).toBe("pi_123")
  })

  it("updates order with payment intent ID on success", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    vi.mocked(createPaymentIntent).mockResolvedValue({
      success: true,
      transactionId: "pi_456",
      clientSecret: "secret",
    })
    vi.mocked(db.order.update).mockResolvedValue({} as never)

    await POST(makeRequest(validBody))

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        paymentIntentId: "pi_456",
        paymentMethod: "stripe",
        paymentStatus: "pending",
      },
    })
  })

  it("returns 502 when payment provider fails", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      paymentEnabled: true,
      acceptedPayments: ["stripe"],
    } as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)
    vi.mocked(createPaymentIntent).mockResolvedValue({
      success: false,
      error: "Card declined",
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toBe("Card declined")
  })
})
