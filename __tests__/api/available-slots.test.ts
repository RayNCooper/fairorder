import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db", () => ({
  db: {
    location: { findUnique: vi.fn() },
    order: { findMany: vi.fn() },
  },
}))

import { GET } from "@/app/api/orders/available-slots/route"
import { db } from "@/lib/db"

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/orders/available-slots")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

describe("GET /api/orders/available-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 if locationId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/orders/available-slots"))
    expect(res.status).toBe(400)
  })

  it("returns 404 if location not found", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue(null as never)
    const res = await GET(makeRequest({ locationId: "nonexistent" }))
    expect(res.status).toBe(404)
  })

  it("returns 404 if location not public", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      id: "loc-1",
      isPublic: false,
    } as never)
    const res = await GET(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(404)
  })

  it("returns empty slots if ordering disabled", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      id: "loc-1",
      isPublic: true,
      orderingEnabled: false,
    } as never)
    const res = await GET(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots).toEqual([])
  })

  it("returns empty slots if no operating hours", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      id: "loc-1",
      isPublic: true,
      orderingEnabled: true,
      operatingHours: null,
      timezone: "Europe/Berlin",
      orderLeadTimeMinutes: 10,
      slotIntervalMinutes: 15,
      maxOrdersPerSlot: null,
    } as never)
    const res = await GET(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots).toEqual([])
  })

  it("returns slots within operating hours", async () => {
    // Set operating hours to a wide window so we always get slots
    vi.mocked(db.location.findUnique).mockResolvedValue({
      id: "loc-1",
      isPublic: true,
      orderingEnabled: true,
      operatingHours: {
        monday: [{ open: "00:00", close: "23:59" }],
        tuesday: [{ open: "00:00", close: "23:59" }],
        wednesday: [{ open: "00:00", close: "23:59" }],
        thursday: [{ open: "00:00", close: "23:59" }],
        friday: [{ open: "00:00", close: "23:59" }],
        saturday: [{ open: "00:00", close: "23:59" }],
        sunday: [{ open: "00:00", close: "23:59" }],
      },
      timezone: "Europe/Berlin",
      orderLeadTimeMinutes: 10,
      slotIntervalMinutes: 15,
      maxOrdersPerSlot: null,
    } as never)

    const res = await GET(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots.length).toBeGreaterThan(0)
    // All slots should have time and label
    for (const slot of json.slots) {
      expect(slot.time).toMatch(/^\d{2}:\d{2}$/)
      expect(slot.label).toContain("Uhr")
      expect(slot.available).toBe(true)
    }
  })

  it("marks slots as unavailable when at capacity", async () => {
    vi.mocked(db.location.findUnique).mockResolvedValue({
      id: "loc-1",
      isPublic: true,
      orderingEnabled: true,
      operatingHours: {
        monday: [{ open: "00:00", close: "23:59" }],
        tuesday: [{ open: "00:00", close: "23:59" }],
        wednesday: [{ open: "00:00", close: "23:59" }],
        thursday: [{ open: "00:00", close: "23:59" }],
        friday: [{ open: "00:00", close: "23:59" }],
        saturday: [{ open: "00:00", close: "23:59" }],
        sunday: [{ open: "00:00", close: "23:59" }],
      },
      timezone: "Europe/Berlin",
      orderLeadTimeMinutes: 10,
      slotIntervalMinutes: 15,
      maxOrdersPerSlot: 1,
    } as never)

    // Create a pickup time matching the first available slot
    const now = new Date()
    const pickupTime = new Date(now.getTime() + 15 * 60 * 1000)
    pickupTime.setMinutes(Math.ceil(pickupTime.getMinutes() / 15) * 15, 0, 0)

    vi.mocked(db.order.findMany).mockResolvedValue([
      { requestedPickupTime: pickupTime },
    ] as never)

    const res = await GET(makeRequest({ locationId: "loc-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    // At least one slot should be marked unavailable
    const hasUnavailable = json.slots.some((s: { available: boolean }) => !s.available)
    expect(hasUnavailable).toBe(true)
  })
})
