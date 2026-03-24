"use client";

import { useState, useEffect, useRef } from "react";

// Lazy-load Stripe.js only when needed
let stripePromise: Promise<import("@stripe/stripe-js").Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    // Dynamic import to avoid loading stripe-js when not using Stripe
    stripePromise = import("@stripe/stripe-js").then((mod) =>
      mod.loadStripe(key)
    );
  }
  return stripePromise;
}

interface PaymentFormProps {
  clientSecret: string;
  amount: number; // cents
  orderId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function StripePaymentForm({
  clientSecret,
  amount,
  orderId,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const [stripe, setStripe] = useState<import("@stripe/stripe-js").Stripe | null>(null);
  const [elements, setElements] = useState<import("@stripe/stripe-js").StripeElements | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const p = getStripe();
    if (!p) {
      onErrorRef.current("Stripe ist nicht konfiguriert.");
      return;
    }
    p.then((s) => {
      if (!s) {
        onErrorRef.current("Stripe konnte nicht geladen werden.");
        return;
      }
      setStripe(s);
      const el = s.elements({
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            borderRadius: "0px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            colorPrimary: "#16A34A",
          },
        },
      });
      setElements(el);
    });
  }, [clientSecret]);

  useEffect(() => {
    if (!elements) return;
    const paymentElement = elements.create("payment");
    paymentElement.mount("#stripe-payment-element");
    paymentElement.on("ready", () => setReady(true));
    return () => paymentElement.unmount();
  }, [elements]);

  async function pollPaymentStatus() {
    setConfirming(true);
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const res = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid") {
            setConfirming(false);
            onSuccess();
            return;
          }
          if (data.status === "failed") {
            setConfirming(false);
            onError("Zahlung fehlgeschlagen.");
            return;
          }
        }
      } catch {
        // Network error — retry
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setConfirming(false);
    onError("Zahlung konnte nicht bestätigt werden. Bitte prüfe deine Bestellung.");
  }

  async function handleSubmit() {
    if (!stripe || !elements) return;
    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Zahlung fehlgeschlagen.");
      setProcessing(false);
    } else {
      setProcessing(false);
      pollPaymentStatus();
    }
  }

  return (
    <div className="space-y-4">
      <div id="stripe-payment-element" className="min-h-[120px]" />
      {ready && (
        <button
          className="flex w-full items-center justify-between bg-green-600 px-4 py-3 text-white hover:bg-green-500 disabled:opacity-50"
          disabled={processing || confirming || !stripe}
          onClick={handleSubmit}
        >
          <span className="text-sm font-bold">
            {confirming
              ? "Zahlung wird bestätigt..."
              : processing
                ? "Wird verarbeitet..."
                : "Jetzt bezahlen"}
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {(amount / 100).toFixed(2).replace(".", ",")}&nbsp;&euro;
          </span>
        </button>
      )}
    </div>
  );
}

// ── Payment method selector ──

export type PaymentMethod = "cash" | "stripe";

interface PaymentMethodSelectorProps {
  acceptedPayments: string[];
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({
  acceptedPayments,
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  const hasStripe = acceptedPayments.includes("stripe");
  const hasCash = acceptedPayments.includes("cash");

  if (!hasStripe) return null; // Only cash — no selector needed

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-stone-700">Bezahlart</p>
      <div className="space-y-2">
        {hasCash && (
          <button
            className={
              selected === "cash"
                ? "flex w-full items-center gap-3 border-2 border-stone-900 bg-white p-3 text-left"
                : "flex w-full items-center gap-3 border border-stone-300 bg-white p-3 text-left hover:border-stone-400"
            }
            onClick={() => onSelect("cash")}
          >
            <span className={
              selected === "cash"
                ? "flex h-5 w-5 items-center justify-center border-2 border-stone-900"
                : "flex h-5 w-5 items-center justify-center border border-stone-400"
            }>
              {selected === "cash" && (
                <span className="h-3 w-3 bg-stone-900" />
              )}
            </span>
            <div>
              <p className="text-sm font-bold text-stone-900">
                Barzahlung an der Kasse
              </p>
              <p className="text-xs text-stone-500">
                Bezahle bei Abholung
              </p>
            </div>
          </button>
        )}
        {hasStripe && (
          <button
            className={
              selected === "stripe"
                ? "flex w-full items-center gap-3 border-2 border-stone-900 bg-white p-3 text-left"
                : "flex w-full items-center gap-3 border border-stone-300 bg-white p-3 text-left hover:border-stone-400"
            }
            onClick={() => onSelect("stripe")}
          >
            <span className={
              selected === "stripe"
                ? "flex h-5 w-5 items-center justify-center border-2 border-stone-900"
                : "flex h-5 w-5 items-center justify-center border border-stone-400"
            }>
              {selected === "stripe" && (
                <span className="h-3 w-3 bg-stone-900" />
              )}
            </span>
            <div>
              <p className="text-sm font-bold text-stone-900">
                Vorauszahlung (Karte)
              </p>
              <p className="text-xs text-stone-500">
                Jetzt online bezahlen
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
