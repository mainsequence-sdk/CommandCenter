import * as React from "react";

import { cn } from "@/lib/utils";

export type CardVariant = "default" | "nested" | "ghost";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, style, variant = "default", ...props }, ref) => {
  const variantClassName =
    variant === "nested"
      ? "rounded-[var(--radius)] border text-card-foreground"
      : variant === "ghost"
        ? "rounded-[var(--radius)] border border-transparent bg-transparent text-card-foreground shadow-none"
        : "rounded-[var(--radius)] border border-border/80 bg-card/85 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur";
  const variantStyle =
    variant === "nested"
      ? {
          borderColor: "var(--card-nested-border-color)",
          background: "var(--card-nested-background)",
          boxShadow: "var(--card-nested-shadow)",
        }
      : undefined;

  return (
    <div
      ref={ref}
      data-card-variant={variant}
      className={cn(variantClassName, className)}
      style={{ ...variantStyle, ...style }}
      {...props}
    />
  );
});

Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, style, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold tracking-tight", className)}
    style={{ fontSize: "var(--font-size-section-title)", ...style }}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-muted-foreground", className)}
    style={{
      fontSize: "var(--font-size-body-sm)",
      lineHeight: "var(--line-height-body)",
      ...style,
    }}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));

CardContent.displayName = "CardContent";
