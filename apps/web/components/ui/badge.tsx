import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type BadgeVariant = "positive" | "negative" | "warning" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  positive: "bg-void-positive/10 text-void-positive",
  negative: "bg-void-negative/10 text-void-negative",
  warning: "bg-void-warning/10 text-void-warning",
  neutral: "bg-void-neutral/10 text-void-neutral",
};

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
