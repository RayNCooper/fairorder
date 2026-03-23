import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/menu-crawler", () => ({
  extractMenuFromUrl: vi.fn(),
}))

import { POST } from "@/app/api/menu-extraction/url/route"
import { getSession } from "@/lib/auth"
import { extractMenuFromUrl } from "@/lib/menu-crawler"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/menu-extraction/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/menu-extraction/url", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ url: "https://example.com" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 if URL missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("URL")
  })

  it("returns 400 if URL is not a string", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const res = await POST(makeRequest({ url: 123 }))
    expect(res.status).toBe(400)
  })

  it("returns extraction result on success", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(extractMenuFromUrl).mockResolvedValue({
      items: [
        { name: "Currywurst", price: 6.5, category: "Hauptgerichte" },
        { name: "Pommes", price: 3.0 },
      ],
      confidence: 0.8,
    })

    const res = await POST(makeRequest({ url: "https://example.com/menu" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(2)
    expect(json.confidence).toBe(0.8)
  })

  it("returns 500 on crawler failure", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(extractMenuFromUrl).mockRejectedValue(
      new Error("Website nicht erreichbar (Zeitüberschreitung).")
    )

    const res = await POST(makeRequest({ url: "https://slow-site.com" }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("Zeitüberschreitung")
    expect(json.items).toEqual([])
  })

  it("returns 500 on SSRF blocked URL", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(extractMenuFromUrl).mockRejectedValue(
      new Error("Diese URL ist nicht erlaubt.")
    )

    const res = await POST(makeRequest({ url: "http://localhost/admin" }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("nicht erlaubt")
  })
})
