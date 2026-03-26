import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface DatenschutzPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DatenschutzPageProps): Promise<Metadata> {
  const { slug } = await params;
  const location = await db.location.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!location) return { title: "Datenschutz" };

  return {
    title: `Datenschutzerkl\u00e4rung — ${location.name}`,
  };
}

export default async function DatenschutzPage({ params }: DatenschutzPageProps) {
  const { slug } = await params;

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      name: true,
      isPublic: true,
      companyName: true,
      responsiblePerson: true,
    },
  });

  if (!location || !location.isPublic) notFound();

  const operator = location.companyName ?? location.name;

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-extrabold text-2xl text-stone-900 mb-2">
          Datenschutzerkl&auml;rung
        </h1>
        <p className="text-stone-500 text-sm mb-8">{location.name}</p>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              1. Verantwortlicher
            </h2>
            <p>
              Verantwortlich f&uuml;r die Datenverarbeitung auf dieser Seite ist{" "}
              <strong>{operator}</strong>
              {location.responsiblePerson && (
                <>, vertreten durch {location.responsiblePerson}</>
              )}
              .
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              2. Welche Daten wir erheben
            </h2>
            <p>
              Bei einer Bestellung erheben wir folgende Daten:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Dein Name (Pflichtfeld, zur Zuordnung der Bestellung)</li>
              <li>E-Mail-Adresse (freiwillig, f&uuml;r Bestellbelege)</li>
              <li>Bestellinhalt und Zeitpunkt</li>
              <li>Zahlungsinformationen (bei Kartenzahlung &uuml;ber Stripe)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              3. Zweck der Verarbeitung
            </h2>
            <p>
              Deine Daten werden ausschlie&szlig;lich zur Abwicklung deiner
              Bestellung und zur Erf&uuml;llung gesetzlicher Aufbewahrungspflichten
              (GoBD, 10 Jahre f&uuml;r steuerrelevante Belege) verarbeitet.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              4. Rechtsgrundlage
            </h2>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
              DSGVO (Vertragserf&uuml;llung) sowie Art. 6 Abs. 1 lit. c DSGVO
              (gesetzliche Aufbewahrungspflichten).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              5. Speicherdauer
            </h2>
            <p>
              Personenbezogene Daten werden gel&ouml;scht, sobald der Zweck der
              Verarbeitung entf&auml;llt. Steuerrelevante Bestelldaten werden gem.
              GoBD 10 Jahre aufbewahrt. Nach Ablauf der Frist werden personenbezogene
              Angaben (Name, E-Mail) anonymisiert.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              6. Deine Rechte
            </h2>
            <p>
              Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung
              (Art. 16), L&ouml;schung (Art. 17, eingeschr&auml;nkt durch
              Aufbewahrungspflichten), Einschr&auml;nkung der Verarbeitung
              (Art. 18) und Daten&uuml;bertragbarkeit (Art. 20).
            </p>
            <p className="mt-2">
              Wende dich bei Fragen an den Betreiber dieses Standorts.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              7. Zahlungsabwicklung
            </h2>
            <p>
              Bei Kartenzahlung werden Zahlungsdaten direkt von{" "}
              <strong>Stripe, Inc.</strong> (Stripe Payments Europe, Ltd.)
              verarbeitet. FairOrder speichert keine Kreditkartendaten.
              Datenschutzhinweise von Stripe:{" "}
              <a
                href="https://stripe.com/de/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 underline"
              >
                stripe.com/de/privacy
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">
              8. Hosting
            </h2>
            <p>
              Diese Anwendung wird betrieben mit FairOrder, einer
              Open-Source-Bestellplattform. Der Quellcode ist &ouml;ffentlich
              einsehbar.
            </p>
          </section>
        </div>

        <div className="mt-12">
          <a
            href={`/${slug}`}
            className="text-sm text-green-600 hover:text-green-700"
          >
            &larr; Zur&uuml;ck zur Speisekarte
          </a>
        </div>
      </div>
    </main>
  );
}
