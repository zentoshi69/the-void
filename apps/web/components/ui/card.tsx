import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddingStyles = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({ className, padding = "md", children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-void-border bg-void-bg-secondary shadow-[0_1px_3px_var(--color-void-shadow)]",
        paddingStyles[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
