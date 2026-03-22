import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    location: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { PUT } from "@/app/api/locations/[id]/route"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/locations/loc-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PUT /api/locations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PUT(makeRequest({ name: "New Name" }), makeParams("loc-1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 if location not found", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findUnique).mockResolvedValue(null as never)
    const res = await PUT(makeRequest({ name: "New Name" }), makeParams("loc-1"))
    expect(res.status).toBe(404)
  })

  it("returns 403 if not owner", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findUnique).mockResolvedValue({
      userId: "other-user",
    } as never)
    const res = await PUT(makeRequest({ name: "New Name" }), makeParams("loc-1"))
    expect(res.status).toBe(403)
  })

  it("updates location name", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never)
    vi.mocked(db.location.update).mockResolvedValue({
      id: "loc-1",
      name: "Updated Kantine",
      orderingEnabled: true,
    } as never)

    const res = await PUT(makeRequest({ name: "Updated Kantine" }), makeParams("loc-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.location.name).toBe("Updated Kantine")
  })

  it("updates orderingEnabled", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never)
    vi.mocked(db.location.update).mockResolvedValue({
      id: "loc-1",
      name: "Kantine",
      orderingEnabled: false,
    } as never)

    const res = await PUT(
      makeRequest({ orderingEnabled: false }),
      makeParams("loc-1")
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.location.orderingEnabled).toBe(false)
  })

  it("returns 400 if name is too short", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never)
    const res = await PUT(makeRequest({ name: "A" }), makeParams("loc-1"))
    expect(res.status).toBe(400)
  })
})
