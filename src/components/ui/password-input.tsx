import * as React from "react";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [passwordVisible, setPasswordVisible] = React.useState(false);
    const toggleLabel = passwordVisible ? "Hide password" : "View password";

    return (
      <div className="relative">
        <input
          ref={ref}
          type={passwordVisible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 pr-11 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
            className,
          )}
          {...props}
        />

        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-[calc(var(--radius)-6px)] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => setPasswordVisible((current) => !current)}
        >
          {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
