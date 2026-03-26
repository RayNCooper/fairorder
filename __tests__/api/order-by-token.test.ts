import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    order: { findUnique: vi.fn() },
  },
}))

import { GET } from "@/app/api/orders/by-token/[token]/route"
import { db } from "@/lib/db"

function makeRequest(token: string) {
  return new NextRequest(`http://localhost/api/orders/by-token/${token}`, {
    method: "GET",
  })
}

const mockOrder = {
  id: "order-1",
  orderNumber: 42,
  customerName: "Max",
  status: "PENDING",
  requestedPickupTime: new Date("2026-03-26T12:30:00Z"),
  paymentMethod: "cash",
  paymentStatus: "pending",
  createdAt: new Date("2026-03-26T12:15:00Z"),
  readyAt: null,
  completedAt: null,
  items: [
    {
      id: "item-1",
      quantity: 2,
      unitPrice: 7.0,
      menuItem: { name: "Schnitzel" },
    },
  ],
  location: {
    name: "Mensa Uni Mainz",
    slug: "mensa-uni-mainz",
  },
}

describe("GET /api/orders/by-token/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns order data for valid token", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)

    const res = await GET(makeRequest("k7Hx9mPq2vNr"), {
      params: Promise.resolve({ token: "k7Hx9mPq2vNr" }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orderNumber).toBe(42)
    expect(data.customerName).toBe("Max")
    expect(data.status).toBe("PENDING")
    expect(data.location.name).toBe("Mensa Uni Mainz")
    expect(data.location.slug).toBe("mensa-uni-mainz")
    expect(data.items).toHaveLength(1)
    expect(data.items[0].menuItem.name).toBe("Schnitzel")
  })

  it("returns 404 for invalid token", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null)

    const res = await GET(makeRequest("invalid-token"), {
      params: Promise.resolve({ token: "invalid-token" }),
    })

    expect(res.status).toBe(404)
  })

  it("queries with select that excludes PII fields", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as never)

    await GET(makeRequest("k7Hx9mPq2vNr"), {
      params: Promise.resolve({ token: "k7Hx9mPq2vNr" }),
    })

    // Verify the Prisma query uses select (not include) to exclude PII
    const call = vi.mocked(db.order.findUnique).mock.calls[0][0] as { select?: Record<string, unknown> }
    expect(call.select).toBeDefined()
    expect(call.select!.customerEmail).toBeUndefined()
    expect(call.select!.customerNote).toBeUndefined()
    expect(call.select!.paymentIntentId).toBeUndefined()
  })
})
