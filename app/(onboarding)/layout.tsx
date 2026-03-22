export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">FairOrder</h1>
      </div>
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}
