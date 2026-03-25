import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "FairOrder – Dein Speiseplan, digital. Das einfachste Tool für Kantinen, Mensen & Bäckereien.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const colors = {
  primary: "#16A34A",
  primaryLight: "#22c55e",
  foreground: "#1a1a1a",
  muted: "#6b7280",
  background: "#FAFAF8",
};

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: colors.background,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: 48,
          }}
        >
          <span style={{ color: colors.primary }}>Fair</span>
          <span style={{ color: colors.foreground }}>Order</span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 32,
          }}
        >
          <span style={{ color: colors.foreground }}>
            Dein Speiseplan,
          </span>
          <span style={{ color: colors.primaryLight }}>digital.</span>
        </div>

        {/* Subheadline */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: colors.muted,
            lineHeight: 1.5,
          }}
        >
          Speiseplan hochladen, QR-Code ausdrucken, fertig.
        </div>

        {/* CTA */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              color: "#ffffff",
              height: 64,
              padding: "0 48px",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Jetzt starten
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
