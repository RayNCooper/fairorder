import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockTransaction = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    location: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  buildOrderConfirmationEmail: vi.fn().mockResolvedValue({ subject: "test", body: "test" }),
}))

import { POST } from "@/app/api/orders/route"
import { db } from "@/lib/db"

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validLocation = {
  id: "loc-1",
  isPublic: true,
  orderingEnabled: true,
  maxActiveOrders: 50,
  maxOrdersPerSlot: null,
  orderLeadTimeMinutes: 10,
  slotIntervalMinutes: 15,
}

const validMenuItem = {
  id: "item-1",
  locationId: "loc-1",
  isAvailable: true,
  price: 5.5,
}

const validBody = {
  locationId: "loc-1",
  customerName: "Max",
  items: [{ menuItemId: "item-1", quantity: 1 }],
}

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid email format", async () => {
    const res = await POST(
      makeRequest({ ...validBody, customerEmail: "not-an-email" })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("E-Mail")
  })

  it("accepts valid email", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(validLocation as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    const mockOrder = { id: "ord-1", orderNumber: 1, token: "abc123def456", items: [], customerEmail: "max@test.de" }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockOrder),
        },
      }
      return fn(tx)
    })

    const res = await POST(
      makeRequest({ ...validBody, customerEmail: "max@test.de" })
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.token).toBeDefined()
    expect(typeof data.token).toBe("string")
  })

  it("returns 400 for pickup time in the past", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(validLocation as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      }
      return fn(tx)
    })

    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const res = await POST(
      makeRequest({ ...validBody, requestedPickupTime: pastTime })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Abholzeit")
  })

  it("returns 400 for invalid pickup time format", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(validLocation as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      }
      return fn(tx)
    })

    const res = await POST(
      makeRequest({ ...validBody, requestedPickupTime: "not-a-date" })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Ungültige Abholzeit")
  })

  it("accepts valid future pickup time", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(validLocation as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    const mockOrder = { id: "ord-1", orderNumber: 1, token: "abc123def456", items: [] }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockOrder),
        },
      }
      return fn(tx)
    })

    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const res = await POST(
      makeRequest({ ...validBody, requestedPickupTime: futureTime })
    )
    expect(res.status).toBe(201)
  })

  it("returns 409 when slot is full", async () => {
    const locationWithSlotLimit = { ...validLocation, maxOrdersPerSlot: 2 }
    vi.mocked(db.location.findUnique).mockResolvedValue(locationWithSlotLimit as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(2), // slot is full
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      }
      return fn(tx)
    })

    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const res = await POST(
      makeRequest({ ...validBody, requestedPickupTime: futureTime })
    )
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain("Zeitfenster")
  })

  it("auto-calculates pickup time when none provided", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(validLocation as never)
    vi.mocked(db.menuItem.findMany).mockResolvedValue([validMenuItem] as never)
    let capturedData: Record<string, unknown> = {}
    const mockOrder = { id: "ord-1", orderNumber: 1, token: "abc123def456", items: [] }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        order: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedData = args.data
            return mockOrder
          }),
        },
      }
      return fn(tx)
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    expect(capturedData.requestedPickupTime).toBeDefined()
    const pickupTime = capturedData.requestedPickupTime as Date
    expect(pickupTime.getTime()).toBeGreaterThan(Date.now())
  })
})
