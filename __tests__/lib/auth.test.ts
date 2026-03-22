import { describe, it, expect, vi } from "vitest"

// Mock dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })
  ),
}))

import { generateToken, getMagicLinkExpiry } from "@/lib/auth"

describe("generateToken", () => {
  it("returns a hex string of 64 characters (32 bytes)", () => {
    const token = generateToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it("returns a different token on each call", () => {
    const token1 = generateToken()
    const token2 = generateToken()
    expect(token1).not.toBe(token2)
  })
})

describe("getMagicLinkExpiry", () => {
  it("returns a Date approximately 15 minutes in the future", () => {
    const before = Date.now()
    const expiry = getMagicLinkExpiry()
    const after = Date.now()

    const fifteenMinutesMs = 15 * 60 * 1000

    expect(expiry).toBeInstanceOf(Date)
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + fifteenMinutesMs)
    expect(expiry.getTime()).toBeLessThanOrEqual(after + fifteenMinutesMs)
  })
})
