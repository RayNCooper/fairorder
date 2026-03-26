import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface ImpressumPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ImpressumPageProps): Promise<Metadata> {
  const { slug } = await params;
  const location = await db.location.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!location) return { title: "Impressum" };

  return {
    title: `Impressum — ${location.name}`,
  };
}

export default async function ImpressumPage({ params }: ImpressumPageProps) {
  const { slug } = await params;

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      name: true,
      isPublic: true,
      companyName: true,
      address: true,
      phone: true,
      vatId: true,
      responsiblePerson: true,
    },
  });

  if (!location || !location.isPublic) notFound();

  const hasLegalInfo = location.companyName || location.address;

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-extrabold text-2xl text-stone-900 mb-2">
          Impressum
        </h1>
        <p className="text-stone-500 text-sm mb-8">{location.name}</p>

        {hasLegalInfo ? (
          <div className="space-y-6">
            <section>
              <h2 className="font-semibold text-sm text-stone-500 uppercase tracking-wide mb-2">
                Angaben gem. &sect; 5 DDG
              </h2>
              {location.companyName && (
                <p className="text-stone-900 text-sm">{location.companyName}</p>
              )}
              {location.address && (
                <p className="text-stone-600 text-sm whitespace-pre-line">
                  {location.address}
                </p>
              )}
            </section>

            {location.phone && (
              <section>
                <h2 className="font-semibold text-sm text-stone-500 uppercase tracking-wide mb-2">
                  Kontakt
                </h2>
                <p className="text-stone-600 text-sm">Tel: {location.phone}</p>
              </section>
            )}

            {location.vatId && (
              <section>
                <h2 className="font-semibold text-sm text-stone-500 uppercase tracking-wide mb-2">
                  USt-IdNr
                </h2>
                <p className="text-stone-600 text-sm font-mono">
                  {location.vatId}
                </p>
              </section>
            )}

            {location.responsiblePerson && (
              <section>
                <h2 className="font-semibold text-sm text-stone-500 uppercase tracking-wide mb-2">
                  Verantwortlich
                </h2>
                <p className="text-stone-600 text-sm">
                  {location.responsiblePerson}
                </p>
              </section>
            )}
          </div>
        ) : (
          <div className="border-l-3 border-amber-400 bg-amber-50 p-4">
            <p className="text-stone-600 text-sm">
              Die rechtlichen Angaben f&uuml;r diesen Standort werden derzeit eingerichtet.
            </p>
          </div>
        )}

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
