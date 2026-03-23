import { describe, it, expect } from "vitest"
import { validateUrl } from "@/lib/menu-crawler"

describe("validateUrl", () => {
  it("accepts valid HTTPS URL", () => {
    const url = validateUrl("https://example.com/speisekarte")
    expect(url.hostname).toBe("example.com")
    expect(url.protocol).toBe("https:")
  })

  it("accepts valid HTTP URL", () => {
    const url = validateUrl("http://example.com/menu")
    expect(url.protocol).toBe("http:")
  })

  it("rejects invalid URL", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Ungültige URL")
  })

  it("rejects non-HTTP protocols", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow("HTTP(S)")
    expect(() => validateUrl("file:///etc/passwd")).toThrow("HTTP(S)")
    expect(() => validateUrl("javascript:alert(1)")).toThrow("HTTP(S)")
  })

  // SSRF protection tests
  it("blocks localhost", () => {
    expect(() => validateUrl("http://localhost/menu")).toThrow("nicht erlaubt")
    expect(() => validateUrl("http://LOCALHOST/menu")).toThrow("nicht erlaubt")
  })

  it("blocks 127.x.x.x", () => {
    expect(() => validateUrl("http://127.0.0.1/menu")).toThrow("nicht erlaubt")
    expect(() => validateUrl("http://127.0.1.1/menu")).toThrow("nicht erlaubt")
  })

  it("blocks 10.x.x.x (private class A)", () => {
    expect(() => validateUrl("http://10.0.0.1/menu")).toThrow("nicht erlaubt")
    expect(() => validateUrl("http://10.255.255.255")).toThrow("nicht erlaubt")
  })

  it("blocks 172.16-31.x.x (private class B)", () => {
    expect(() => validateUrl("http://172.16.0.1")).toThrow("nicht erlaubt")
    expect(() => validateUrl("http://172.31.255.255")).toThrow("nicht erlaubt")
  })

  it("allows 172.32.x.x (outside private range)", () => {
    const url = validateUrl("http://172.32.0.1/menu")
    expect(url.hostname).toBe("172.32.0.1")
  })

  it("blocks 192.168.x.x (private class C)", () => {
    expect(() => validateUrl("http://192.168.0.1")).toThrow("nicht erlaubt")
    expect(() => validateUrl("http://192.168.1.100/menu")).toThrow("nicht erlaubt")
  })

  it("blocks 0.x.x.x", () => {
    expect(() => validateUrl("http://0.0.0.0")).toThrow("nicht erlaubt")
  })

  it("blocks IPv6 loopback", () => {
    expect(() => validateUrl("http://[::1]/menu")).toThrow("nicht erlaubt")
  })

  it("blocks link-local 169.254.x.x", () => {
    expect(() => validateUrl("http://169.254.169.254")).toThrow("nicht erlaubt")
  })
})
