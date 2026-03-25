import { TextLogo } from "@/components/TextLogo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <h1>
          <TextLogo size="md" />
        </h1>
      </div>
      <div className="w-full max-w-2xl has-[.onboarding-wide]:max-w-4xl">
        {children}
      </div>
    </div>
  );
}
