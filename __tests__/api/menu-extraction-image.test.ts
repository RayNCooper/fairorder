import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/menu-extraction", () => ({
  extractMenuFromImage: vi.fn(),
}))

import { POST } from "@/app/api/menu-extraction/image/route"
import { getSession } from "@/lib/auth"
import { extractMenuFromImage } from "@/lib/menu-extraction"

const mockSession = {
  user: { id: "user-1", email: "test@test.de", name: "Test" },
}

function makeFormDataRequest(
  file?: { content: Buffer; type: string; name: string; size?: number }
) {
  const formData = new FormData()
  if (file) {
    const blob = new Blob([file.content], { type: file.type })
    // Override size if specified
    const f = new File([blob], file.name, { type: file.type })
    formData.append("file", f)
  }
  return new NextRequest("http://localhost/api/menu-extraction/image", {
    method: "POST",
    body: formData,
  })
}

describe("POST /api/menu-extraction/image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await POST(makeFormDataRequest())
    expect(res.status).toBe(401)
  })

  it("returns 400 if no file uploaded", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const req = new NextRequest("http://localhost/api/menu-extraction/image", {
      method: "POST",
      body: new FormData(),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for unsupported file type", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const res = await POST(
      makeFormDataRequest({
        content: Buffer.from("not-an-image"),
        type: "application/pdf",
        name: "menu.pdf",
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("JPEG, PNG")
  })

  it("returns extraction result on success", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(extractMenuFromImage).mockResolvedValue({
      items: [{ name: "Pasta", price: 8.5 }],
      confidence: 0.9,
    })

    const res = await POST(
      makeFormDataRequest({
        content: Buffer.from("fake-jpeg"),
        type: "image/jpeg",
        name: "menu.jpg",
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(1)
    expect(json.confidence).toBe(0.9)
  })

  it("returns 500 on extraction failure", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(extractMenuFromImage).mockRejectedValue(
      new Error("Gemini API error")
    )

    const res = await POST(
      makeFormDataRequest({
        content: Buffer.from("fake"),
        type: "image/png",
        name: "menu.png",
      })
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("Gemini API error")
    expect(json.items).toEqual([])
  })
})
