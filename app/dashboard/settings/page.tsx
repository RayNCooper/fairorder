import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  LocationSettingsForm,
  FeaturesSection,
  LegalInfoSection,
  AccountSection,
} from "@/components/dashboard/settings-forms";

export const metadata: Metadata = {
  title: "Einstellungen",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
  });

  if (!location) redirect("/setup");

  // Serialize location data for client components
  const locationData = {
    id: location.id,
    name: location.name,
    slug: location.slug,
    operatingHours: location.operatingHours
      ? typeof location.operatingHours === "string"
        ? location.operatingHours
        : JSON.stringify(location.operatingHours, null, 2)
      : null,
    slotIntervalMinutes: location.slotIntervalMinutes ?? 15,
    orderingEnabled: location.orderingEnabled,
    maxActiveOrders: location.maxActiveOrders,
    maxOrdersPerSlot: location.maxOrdersPerSlot,
    paymentEnabled: location.paymentEnabled,
    acceptedPayments: location.acceptedPayments,
    companyName: location.companyName,
    address: location.address,
    phone: location.phone,
    vatId: location.vatId,
    responsiblePerson: location.responsiblePerson,
  };

  const userData = {
    email: session.user.email,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Einstellungen</h1>

      <div className="space-y-4">
        <LocationSettingsForm location={locationData} />
        <FeaturesSection location={locationData} />
        <LegalInfoSection location={locationData} />
        <AccountSection user={userData} />
      </div>
    </div>
  );
}
