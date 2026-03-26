import { describe, it, expect, vi } from "vitest"

// Mock nodemailer to prevent import errors
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn() },
  createTransport: vi.fn(),
}))

import { buildMagicLinkEmail, buildOrderReadyEmail, buildOrderConfirmationEmail } from "@/lib/email"

describe("buildMagicLinkEmail", () => {
  it("returns subject and HTML body", async () => {
    const result = await buildMagicLinkEmail("https://app.fair-order.de/verify?token=abc")
    expect(result.subject).toBe("Dein Login-Link für FairOrder")
    expect(result.body).toContain("html")
    expect(result.body).toContain("Einloggen")
    expect(result.body).toContain("https://app.fair-order.de/verify?token=abc")
  })

  it("includes the logo image", async () => {
    const result = await buildMagicLinkEmail("https://example.com/verify")
    expect(result.body).toContain("/images/logo.png")
  })

  it("includes preview text", async () => {
    const result = await buildMagicLinkEmail("https://example.com/verify")
    expect(result.body).toContain("Login-Link")
  })
})

describe("buildOrderReadyEmail", () => {
  it("returns subject with order number", async () => {
    const result = await buildOrderReadyEmail(42, "Max", "Müllers Bäckerei")
    expect(result.subject).toBe("Deine Bestellung #42 ist bereit!")
  })

  it("includes customer name and location in body", async () => {
    const result = await buildOrderReadyEmail(42, "Max", "Müllers Bäckerei")
    expect(result.body).toContain("Max")
    expect(result.body).toContain("Müllers Bäckerei")
    expect(result.body).toContain("#42")
  })

  it("includes the logo image", async () => {
    const result = await buildOrderReadyEmail(1, "Test", "Test Location")
    expect(result.body).toContain("/images/logo.png")
  })

  it("renders valid HTML", async () => {
    const result = await buildOrderReadyEmail(1, "Test", "Test Location")
    expect(result.body).toContain("<!DOCTYPE html")
    expect(result.body).toContain("</html>")
  })

  it("escapes HTML in customer name", async () => {
    const result = await buildOrderReadyEmail(1, '<script>alert("xss")</script>', "Location")
    // React-email auto-escapes — the script tag should not appear as raw HTML
    expect(result.body).not.toContain("<script>alert")
  })

  it("includes order page link when provided", async () => {
    const result = await buildOrderReadyEmail(42, "Max", "Müllers Bäckerei", "https://app.fair-order.de/order/abc123")
    expect(result.body).toContain("https://app.fair-order.de/order/abc123")
    expect(result.body).toContain("Bestellung ansehen")
  })
})

describe("buildOrderConfirmationEmail", () => {
  const params = {
    orderNumber: 42,
    customerName: "Max",
    locationName: "Mensa Uni Mainz",
    items: [
      { name: "Schnitzel", quantity: 2, unitPrice: 7.0 },
      { name: "Apfelschorle", quantity: 1, unitPrice: 2.5 },
    ],
    total: 16.5,
    pickupTime: new Date("2026-03-26T12:30:00Z"),
    orderPageUrl: "https://app.fair-order.de/order/k7Hx9mPq2vNr",
  }

  it("returns subject with order number", async () => {
    const result = await buildOrderConfirmationEmail(params)
    expect(result.subject).toBe("Bestellbestätigung #42")
  })

  it("includes item names in body", async () => {
    const result = await buildOrderConfirmationEmail(params)
    expect(result.body).toContain("Schnitzel")
    expect(result.body).toContain("Apfelschorle")
  })

  it("includes order page link", async () => {
    const result = await buildOrderConfirmationEmail(params)
    expect(result.body).toContain("https://app.fair-order.de/order/k7Hx9mPq2vNr")
    expect(result.body).toContain("Bestellung verfolgen")
  })

  it("includes customer name and location", async () => {
    const result = await buildOrderConfirmationEmail(params)
    expect(result.body).toContain("Max")
    expect(result.body).toContain("Mensa Uni Mainz")
  })

  it("renders valid HTML", async () => {
    const result = await buildOrderConfirmationEmail(params)
    expect(result.body).toContain("<!DOCTYPE html")
    expect(result.body).toContain("</html>")
  })
})
