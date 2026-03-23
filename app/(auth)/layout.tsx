import { TextLogo } from "@/components/TextLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1>
            <TextLogo size="md" />
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
