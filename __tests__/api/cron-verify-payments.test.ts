import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockFindMany = vi.fn()
const mockUpdateMany = vi.fn()
const mockVerifyPayment = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

vi.mock("@/lib/payment", () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
}))

import { GET } from "@/app/api/cron/verify-payments/route"

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader) headers["authorization"] = authHeader

  return new NextRequest("http://localhost/api/cron/verify-payments", {
    method: "GET",
    headers,
  })
}

describe("GET /api/cron/verify-payments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "test-cron-secret")
  })

  it("returns 401 if no authorization header", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 if CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(401)
  })

  it("returns 401 if authorization token is wrong", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"))
    expect(res.status).toBe(401)
  })

  it("returns { checked: 0 } when no pending orders", async () => {
    mockFindMany.mockResolvedValue([])

    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ checked: 0, confirmed: 0, failed: 0 })
  })

  it("queries only orders older than 2 minutes with pending status", async () => {
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest("Bearer test-cron-secret"))

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        paymentStatus: "pending",
        paymentIntentId: { not: null },
        createdAt: { lt: expect.any(Date) },
      },
      select: {
        id: true,
        paymentIntentId: true,
        paymentMethod: true,
      },
      take: 50,
      orderBy: { createdAt: "asc" },
    })

    // Verify the date is approximately 2 minutes ago
    const callArgs = mockFindMany.mock.calls[0][0]
    const cutoff = callArgs.where.createdAt.lt as Date
    const twoMinAgo = Date.now() - 2 * 60 * 1000
    expect(Math.abs(cutoff.getTime() - twoMinAgo)).toBeLessThan(5000)
  })

  it("confirms paid orders and marks failed ones", async () => {
    mockFindMany.mockResolvedValue([
      { id: "order-paid", paymentIntentId: "pi_paid", paymentMethod: "stripe" },
      { id: "order-failed", paymentIntentId: "pi_failed", paymentMethod: "stripe" },
      { id: "order-pending", paymentIntentId: "pi_pending", paymentMethod: "stripe" },
    ])

    mockVerifyPayment.mockImplementation((id: string) => {
      if (id === "pi_paid") return Promise.resolve("paid")
      if (id === "pi_failed") return Promise.resolve("failed")
      return Promise.resolve("pending")
    })

    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ checked: 3, confirmed: 1, failed: 1 })

    // Verify paid order was updated
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-paid",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "paid",
        paidAt: expect.any(Date),
      },
    })

    // Verify failed order was updated
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-failed",
        paymentStatus: { not: "paid" },
      },
      data: {
        paymentStatus: "failed",
      },
    })

    // Pending order should not trigger any update
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
  })

  it("continues processing other orders when one fails", async () => {
    mockFindMany.mockResolvedValue([
      { id: "order-error", paymentIntentId: "pi_error", paymentMethod: "stripe" },
      { id: "order-ok", paymentIntentId: "pi_ok", paymentMethod: "stripe" },
    ])

    mockVerifyPayment.mockImplementation((id: string) => {
      if (id === "pi_error") return Promise.reject(new Error("Stripe down"))
      return Promise.resolve("paid")
    })

    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ checked: 2, confirmed: 1, failed: 0 })
  })

  it("returns 500 on DB query error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB down"))

    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(500)
  })

  it("skips orders without paymentIntentId", async () => {
    mockFindMany.mockResolvedValue([
      { id: "order-no-pi", paymentIntentId: null },
    ])

    const res = await GET(makeRequest("Bearer test-cron-secret"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ checked: 1, confirmed: 0, failed: 0 })
    expect(mockVerifyPayment).not.toHaveBeenCalled()
  })
})
