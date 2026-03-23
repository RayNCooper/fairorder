import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { PUT } from "@/app/api/orders/[id]/status/route"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/orders/order-1/status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockOrder(status: string, ownerId = "user-1") {
  return {
    id: "order-1",
    status,
    location: { userId: ownerId },
  }
}

describe("PUT /api/orders/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PUT(makeRequest({ status: "PREPARING" }), makeParams("order-1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid status string", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const res = await PUT(makeRequest({ status: "INVALID" }), makeParams("order-1"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Ungültiger Status")
  })

  it("returns 404 if order not found", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(null as never)
    const res = await PUT(makeRequest({ status: "PREPARING" }), makeParams("order-1"))
    expect(res.status).toBe(404)
  })

  it("returns 403 if not owner", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("PENDING", "other-user") as never)
    const res = await PUT(makeRequest({ status: "PREPARING" }), makeParams("order-1"))
    expect(res.status).toBe(403)
  })

  it("allows PENDING -> PREPARING", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("PENDING") as never)
    vi.mocked(db.order.update).mockResolvedValue({ id: "order-1", status: "PREPARING" } as never)
    const res = await PUT(makeRequest({ status: "PREPARING" }), makeParams("order-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.order.status).toBe("PREPARING")
  })

  it("rejects PENDING -> READY (not allowed)", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("PENDING") as never)
    const res = await PUT(makeRequest({ status: "READY" }), makeParams("order-1"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Ungültiger Statuswechsel")
  })

  it("allows PREPARING -> READY", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("PREPARING") as never)
    vi.mocked(db.order.update).mockResolvedValue({ id: "order-1", status: "READY" } as never)
    const res = await PUT(makeRequest({ status: "READY" }), makeParams("order-1"))
    expect(res.status).toBe(200)
  })

  it("allows READY -> COMPLETED", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("READY") as never)
    vi.mocked(db.order.update).mockResolvedValue({ id: "order-1", status: "COMPLETED" } as never)
    const res = await PUT(makeRequest({ status: "COMPLETED" }), makeParams("order-1"))
    expect(res.status).toBe(200)
  })

  it("allows any status -> CANCELLED", async () => {
    for (const fromStatus of ["PENDING", "PREPARING", "READY"]) {
      vi.clearAllMocks()
      vi.mocked(getSession).mockResolvedValue(mockSession as never)
      vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder(fromStatus) as never)
      vi.mocked(db.order.update).mockResolvedValue({ id: "order-1", status: "CANCELLED" } as never)
      const res = await PUT(makeRequest({ status: "CANCELLED" }), makeParams("order-1"))
      expect(res.status).toBe(200)
    }
  })

  it("rejects COMPLETED -> any transition", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("COMPLETED") as never)
    const res = await PUT(makeRequest({ status: "PREPARING" }), makeParams("order-1"))
    expect(res.status).toBe(400)
  })

  it("rejects CANCELLED -> any transition", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder("CANCELLED") as never)
    const res = await PUT(makeRequest({ status: "PENDING" }), makeParams("order-1"))
    expect(res.status).toBe(400)
  })
})
