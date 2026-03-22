import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
};

// The actual verification happens via the API route (GET /api/auth/verify?token=...)
// This page is a fallback that redirects to the API route
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login?error=invalid");
  }

  // Redirect to the API route which handles verification and session creation
  redirect(`/api/auth/verify?token=${token}`);
}
