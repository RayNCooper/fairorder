import { describe, it, expect } from "vitest";
import {
  calculateVat,
  calculateLineItemVat,
  isValidVatRate,
} from "@/lib/vat";

describe("calculateVat", () => {
  it("calculates 7% VAT for food items", () => {
    const result = calculateVat(1910, 7);
    expect(result.netCents).toBe(1785);
    expect(result.vatCents).toBe(125);
    expect(result.netCents + result.vatCents).toBe(1910);
  });

  it("calculates 19% VAT for beverages", () => {
    const result = calculateVat(280, 19);
    expect(result.netCents).toBe(235);
    expect(result.vatCents).toBe(45);
    expect(result.netCents + result.vatCents).toBe(280);
  });

  it("handles 1 cent edge case", () => {
    const result = calculateVat(1, 7);
    expect(result.netCents + result.vatCents).toBe(1);
  });

  it("handles zero gross", () => {
    const result = calculateVat(0, 7);
    expect(result).toEqual({ netCents: 0, vatCents: 0 });
  });

  it("handles 0% VAT (exempt)", () => {
    const result = calculateVat(100, 0);
    expect(result).toEqual({ netCents: 100, vatCents: 0 });
  });

  it("rejects negative grossCents", () => {
    expect(() => calculateVat(-100, 7)).toThrow("non-negative");
  });

  it("rejects invalid VAT rate", () => {
    expect(() => calculateVat(100, 5)).toThrow("Invalid VAT rate");
    expect(() => calculateVat(100, 20)).toThrow("Invalid VAT rate");
  });

  it("maintains invariant: net + vat === gross for all amounts 1-10000 at 7%", () => {
    for (let cents = 1; cents <= 10000; cents++) {
      const result = calculateVat(cents, 7);
      expect(result.netCents + result.vatCents).toBe(cents);
    }
  });

  it("maintains invariant: net + vat === gross for all amounts 1-10000 at 19%", () => {
    for (let cents = 1; cents <= 10000; cents++) {
      const result = calculateVat(cents, 19);
      expect(result.netCents + result.vatCents).toBe(cents);
    }
  });
});

describe("calculateLineItemVat", () => {
  it("calculates per-line-item (not per-unit) rounding", () => {
    // 3 items at 333 cents each = 999 cents gross
    const result = calculateLineItemVat(333, 3, 7);
    expect(result.netCents + result.vatCents).toBe(999);
  });

  it("handles single quantity", () => {
    const result = calculateLineItemVat(1910, 1, 7);
    expect(result).toEqual({ netCents: 1785, vatCents: 125 });
  });
});

describe("isValidVatRate", () => {
  it("accepts valid rates", () => {
    expect(isValidVatRate(0)).toBe(true);
    expect(isValidVatRate(7)).toBe(true);
    expect(isValidVatRate(19)).toBe(true);
  });

  it("rejects invalid rates", () => {
    expect(isValidVatRate(5)).toBe(false);
    expect(isValidVatRate(20)).toBe(false);
    expect(isValidVatRate(-1)).toBe(false);
  });
});
