import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
  },
}))

import { POST } from "@/app/api/categories/route"
import { PUT, DELETE } from "@/app/api/categories/[id]/route"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

const mockLocation = { id: "loc-1", userId: "user-1" }

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ name: "Drinks" }))
    expect(res.status).toBe(401)
  })

  it("returns 404 if no location found", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(null as never)
    const res = await POST(makeRequest({ name: "Drinks" }))
    expect(res.status).toBe(404)
  })

  it("creates category and returns 201", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    vi.mocked(db.category.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.category.create).mockResolvedValue({
      id: "cat-1",
      name: "Drinks",
      locationId: "loc-1",
      sortOrder: 0,
      menuItems: [],
    } as never)

    const res = await POST(makeRequest({ name: "Drinks" }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.category.name).toBe("Drinks")
  })

  it("returns 400 if name is empty", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    const res = await POST(makeRequest({ name: "" }))
    expect(res.status).toBe(400)
  })
})

describe("PUT /api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }) as never
    const res = await PUT(req, makeParams("cat-1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 if not owner (verifyOwnership fails)", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat-1",
      location: { userId: "other-user" },
    } as never)

    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }) as never
    const res = await PUT(req, makeParams("cat-1"))
    expect(res.status).toBe(404)
  })

  it("updates category name", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat-1",
      location: { userId: "user-1" },
    } as never)
    vi.mocked(db.category.update).mockResolvedValue({
      id: "cat-1",
      name: "Updated",
      menuItems: [],
    } as never)

    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }) as never
    const res = await PUT(req, makeParams("cat-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.category.name).toBe("Updated")
  })
})

describe("DELETE /api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("cat-1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 if not owner", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat-1",
      location: { userId: "other-user" },
    } as never)

    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("cat-1"))
    expect(res.status).toBe(404)
  })

  it("deletes category and returns success", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat-1",
      location: { userId: "user-1" },
    } as never)
    vi.mocked(db.category.delete).mockResolvedValue({} as never)

    const req = new Request("http://localhost/api/categories/cat-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("cat-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
