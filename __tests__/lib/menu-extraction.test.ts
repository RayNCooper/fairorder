import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}))

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

describe("menu extraction — console provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("MENU_EXTRACTION_PROVIDER", "console")
  })

  it("extractMenuFromImage returns mock data", async () => {
    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromImage(Buffer.from("fake"), "image/jpeg")
    expect(result.items).toHaveLength(3)
    expect(result.confidence).toBe(1)
    expect(result.items[0].name).toBe("Currywurst mit Pommes")
  })

  it("extractMenuFromText returns mock data", async () => {
    const { extractMenuFromText } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromText("some menu text")
    expect(result.items).toHaveLength(3)
    expect(result.confidence).toBe(1)
  })
})

describe("menu extraction — gemini provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("MENU_EXTRACTION_PROVIDER", "gemini")
    vi.stubEnv("GEMINI_API_KEY", "test-key")
  })

  it("extractMenuFromImage calls generateObject with image", async () => {
    const { generateObject } = await import("ai")
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        items: [
          { name: "Schnitzel", price: 12.5, category: "Hauptgerichte" },
          { name: "Pommes", price: 3.5 },
        ],
      },
      usage: { totalTokens: 100 },
    } as never)

    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromImage(
      Buffer.from("fake-image"),
      "image/jpeg"
    )

    expect(result.items).toHaveLength(2)
    expect(result.items[0].name).toBe("Schnitzel")
    expect(result.confidence).toBeGreaterThan(0)
    expect(vi.mocked(generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Speisekarten-Parser"),
      })
    )
  })

  it("extractMenuFromText calls generateObject with text prompt", async () => {
    const { generateObject } = await import("ai")
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        items: [
          { name: "Salat", price: 7.0 },
        ],
      },
      usage: { totalTokens: 50 },
    } as never)

    const { extractMenuFromText } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromText("Salat 7,00 EUR")

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe("Salat")
  })

  it("returns confidence 0 when no items extracted", async () => {
    const { generateObject } = await import("ai")
    vi.mocked(generateObject).mockResolvedValue({
      object: { items: [] },
      usage: { totalTokens: 10 },
    } as never)

    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromImage(Buffer.from("empty"), "image/png")
    expect(result.items).toHaveLength(0)
    expect(result.confidence).toBe(0)
  })

  it("filters out items with empty names", async () => {
    const { generateObject } = await import("ai")
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        items: [
          { name: "Valid Item", price: 5.0 },
          { name: "   ", price: 3.0 },
          { name: "", price: 1.0 },
        ],
      },
      usage: { totalTokens: 20 },
    } as never)

    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    const result = await extractMenuFromImage(Buffer.from("x"), "image/jpeg")
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe("Valid Item")
  })

  it("confidence scales with price coverage", async () => {
    const { generateObject } = await import("ai")

    // All items have prices → high confidence
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        items: [
          { name: "A", price: 5.0 },
          { name: "B", price: 3.0 },
        ],
      },
      usage: { totalTokens: 10 },
    } as never)

    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    const highConf = await extractMenuFromImage(Buffer.from("x"), "image/jpeg")
    expect(highConf.confidence).toBe(1) // 0.3 + 1.0 * 0.7 = 1.0

    // No items have prices → lower confidence
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        items: [
          { name: "A" },
          { name: "B" },
        ],
      },
      usage: { totalTokens: 10 },
    } as never)

    const lowConf = await extractMenuFromImage(Buffer.from("x"), "image/jpeg")
    expect(lowConf.confidence).toBe(0.3) // 0.3 + 0 * 0.7 = 0.3
  })
})

describe("menu extraction — missing API key", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("MENU_EXTRACTION_PROVIDER", "gemini")
    delete process.env.GEMINI_API_KEY
  })

  it("throws when GEMINI_API_KEY missing for image extraction", async () => {
    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    await expect(
      extractMenuFromImage(Buffer.from("x"), "image/jpeg")
    ).rejects.toThrow("GEMINI_API_KEY")
  })

  it("throws when GEMINI_API_KEY missing for text extraction", async () => {
    const { extractMenuFromText } = await import("@/lib/menu-extraction")
    await expect(
      extractMenuFromText("some text")
    ).rejects.toThrow("GEMINI_API_KEY")
  })
})

describe("menu extraction — unknown provider", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("MENU_EXTRACTION_PROVIDER", "openai")
  })

  it("throws for unknown provider on image extraction", async () => {
    const { extractMenuFromImage } = await import("@/lib/menu-extraction")
    await expect(
      extractMenuFromImage(Buffer.from("x"), "image/jpeg")
    ).rejects.toThrow("Unknown MENU_EXTRACTION_PROVIDER")
  })

  it("throws for unknown provider on text extraction", async () => {
    const { extractMenuFromText } = await import("@/lib/menu-extraction")
    await expect(
      extractMenuFromText("text")
    ).rejects.toThrow("Unknown MENU_EXTRACTION_PROVIDER")
  })
})
