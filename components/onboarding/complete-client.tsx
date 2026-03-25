"use client";

import { useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { IconDownload } from "@tabler/icons-react";

interface CompleteQRProps {
  locationName: string;
  locationSlug: string;
  siteUrl: string;
}

export function CompleteQR({
  locationName,
  locationSlug,
  siteUrl,
}: CompleteQRProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const menuUrl = `${siteUrl}/${locationSlug}`;

  const handleDownloadPoster = useCallback(() => {
    const svgEl = qrRef.current?.querySelector("svg");
    if (!svgEl) return;

    // Serialize SVG to a data URL
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Create A4 canvas (595 x 842 at 72 DPI, we use 2x for quality)
      const canvas = document.createElement("canvas");
      const w = 1190;
      const h = 1684;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // White background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);

      // Location name
      ctx.fillStyle = "#0A0A0A";
      ctx.font = "bold 64px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(locationName, w / 2, 200);

      // QR code centered
      const qrSize = 600;
      const qrX = (w - qrSize) / 2;
      const qrY = 320;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // URL below QR
      ctx.fillStyle = "#666666";
      ctx.font = "36px 'JetBrains Mono', monospace";
      ctx.fillText(menuUrl, w / 2, qrY + qrSize + 80);

      // CTA text
      ctx.fillStyle = "#0A0A0A";
      ctx.font = "bold 48px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("Jetzt Speisekarte ansehen", w / 2, qrY + qrSize + 180);

      // Logo at bottom
      const logoImg = new Image();
      logoImg.onload = () => {
        const logoMaxH = 60;
        const logoScale = logoMaxH / logoImg.naturalHeight;
        const logoW = logoImg.naturalWidth * logoScale;
        ctx.drawImage(
          logoImg,
          (w - logoW) / 2,
          h - 80 - logoMaxH / 2,
          logoW,
          logoMaxH
        );

        // Download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${locationSlug}-qr-poster.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      };
      logoImg.src = "/images/logo.png";

      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }, [locationName, locationSlug, menuUrl]);

  return (
    <>
      <div ref={qrRef} className="bg-white p-4">
        <QRCodeSVG
          value={menuUrl}
          size={224}
          level="M"
          bgColor="#FFFFFF"
          fgColor="#0A0A0A"
        />
      </div>

      <p className="font-mono text-xs text-muted-foreground">{menuUrl}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleDownloadPoster}
          className="inline-flex h-11 items-center justify-center gap-2 border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent"
        >
          <IconDownload className="h-4 w-4" />
          QR-Poster herunterladen
        </button>
      </div>
    </>
  );
}
