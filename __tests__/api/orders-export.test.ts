import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    location: { findFirst: vi.fn() },
    order: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/orders/export/route";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/orders/export");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

const mockSession = { userId: "user-1", user: { id: "user-1", email: "test@test.de" } };

const mockLocation = {
  id: "loc-1",
  name: "Test Kantine",
  companyName: "Test GmbH",
  vatId: "DE123456789",
};

const mockOrder = {
  orderNumber: 1,
  createdAt: new Date("2026-03-15T12:00:00Z"),
  paymentMethod: "cash",
  paymentStatus: "paid",
  customerName: "Max Mustermann",
  items: [
    {
      quantity: 2,
      unitPrice: 6.4,
      vatRate: 7,
      netAmountCents: 1196,
      vatAmountCents: 84,
      menuItem: { name: "Schnitzel" },
    },
  ],
};

describe("GET /api/orders/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(makeRequest({ locationId: "loc-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 without locationId", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned location", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(db.location.findFirst).mockResolvedValue(null as never);
    const res = await GET(makeRequest({ locationId: "loc-other" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid date params", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never);
    const res = await GET(makeRequest({ locationId: "loc-1", from: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("returns CSV with correct headers and VAT columns", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never);
    vi.mocked(db.order.findMany).mockResolvedValue([mockOrder] as never);

    const res = await GET(makeRequest({ locationId: "loc-1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");

    const csv = await res.text();
    const lines = csv.split("\n");

    // Check header row
    expect(lines[0]).toContain("MwSt.-Satz");
    expect(lines[0]).toContain("Netto (Cent)");
    expect(lines[0]).toContain("MwSt. (Cent)");

    // Check data row
    expect(lines[1]).toContain("Schnitzel");
    expect(lines[1]).toContain("7%");
    expect(lines[1]).toContain("1196");
    expect(lines[1]).toContain("84");
  });

  it("returns 404 when no orders in date range", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(db.location.findFirst).mockResolvedValue(mockLocation as never);
    vi.mocked(db.order.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest({ locationId: "loc-1", from: "2099-01-01" }));
    expect(res.status).toBe(404);
  });
});
