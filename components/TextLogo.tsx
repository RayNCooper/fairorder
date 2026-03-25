import { cn } from "@/lib/utils"

interface TextLogoProps {
  className?: string
  /** Size variant — "inline" inherits parent font size */
  size?: "inline" | "sm" | "md" | "lg"
}

/**
 * Inlinable text-based FairOrder logo. No image dependency —
 * can be used in emails, OG images, loading states, etc.
 */
export function TextLogo({ className, size = "inline" }: TextLogoProps) {
  const sizeClasses = {
    inline: "",
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }

  return (
    <span
      className={cn(
        "font-extrabold tracking-tighter select-none whitespace-nowrap",
        sizeClasses[size],
        className
      )}
      aria-label="FairOrder"
    >
      <span className="text-primary">Fair</span>
      <span className="text-foreground">Order</span>
    </span>
  )
}
