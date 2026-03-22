import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    menuItem: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { POST } from "@/app/api/menu-items/route"
import { POST as BULK_POST } from "@/app/api/menu-items/bulk/route"
import { PUT, DELETE } from "@/app/api/menu-items/[id]/route"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

const mockLocation = { id: "loc-1", userId: "user-1" }

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/menu-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/menu-items", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ name: "Pasta", price: 8.5 }))
    expect(res.status).toBe(401)
  })

  it("returns 404 if no location found", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(null as never)
    const res = await POST(makeRequest({ name: "Pasta", price: 8.5 }))
    expect(res.status).toBe(404)
  })

  it("returns 404 if category not owned", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    vi.mocked(db.category.findFirst).mockResolvedValue(null as never)
    const res = await POST(
      makeRequest({ name: "Pasta", price: 8.5, categoryId: "cat-wrong" })
    )
    expect(res.status).toBe(404)
  })

  it("creates menu item and returns 201", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    vi.mocked(db.menuItem.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.menuItem.create).mockResolvedValue({
      id: "item-1",
      name: "Pasta",
      price: 8.5,
      locationId: "loc-1",
    } as never)

    const res = await POST(makeRequest({ name: "Pasta", price: 8.5 }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.menuItem.name).toBe("Pasta")
  })

  it("returns 400 if price is invalid", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    const res = await POST(makeRequest({ name: "Pasta", price: -5 }))
    expect(res.status).toBe(400)
  })
})

describe("POST /api/menu-items/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/menu-items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "A", price: "1" }] }),
    }) as never
    const res = await BULK_POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for empty items array", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    const req = new Request("http://localhost/api/menu-items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    }) as never
    const res = await BULK_POST(req)
    expect(res.status).toBe(400)
  })

  it("bulk creates items via transaction and returns count", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never)
    vi.mocked(db.menuItem.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.$transaction).mockResolvedValue([
      { id: "item-1", name: "Schnitzel" },
      { id: "item-2", name: "Salat" },
    ] as never)

    const req = new Request("http://localhost/api/menu-items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { name: "Schnitzel", price: "8,50" },
          { name: "Salat", price: "5.00" },
        ],
      }),
    }) as never
    const res = await BULK_POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.count).toBe(2)
  })
})

describe("PUT /api/menu-items/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }) as never
    const res = await PUT(req, makeParams("item-1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 if not owner", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "item-1",
      locationId: "loc-1",
      location: { userId: "other-user" },
    } as never)

    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }) as never
    const res = await PUT(req, makeParams("item-1"))
    expect(res.status).toBe(404)
  })

  it("updates item fields", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "item-1",
      locationId: "loc-1",
      location: { userId: "user-1" },
    } as never)
    vi.mocked(db.menuItem.update).mockResolvedValue({
      id: "item-1",
      name: "Updated Pasta",
      price: 9.5,
    } as never)

    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Pasta", price: 9.5 }),
    }) as never
    const res = await PUT(req, makeParams("item-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.menuItem.name).toBe("Updated Pasta")
    expect(json.menuItem.price).toBe(9.5)
  })
})

describe("DELETE /api/menu-items/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("item-1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 if not owner", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "item-1",
      locationId: "loc-1",
      location: { userId: "other-user" },
    } as never)

    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("item-1"))
    expect(res.status).toBe(404)
  })

  it("deletes item and returns success", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "item-1",
      locationId: "loc-1",
      location: { userId: "user-1" },
    } as never)
    vi.mocked(db.menuItem.delete).mockResolvedValue({} as never)

    const req = new Request("http://localhost/api/menu-items/item-1", {
      method: "DELETE",
    }) as never
    const res = await DELETE(req, makeParams("item-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
