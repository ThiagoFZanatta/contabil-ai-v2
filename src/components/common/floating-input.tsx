import * as React from "react";
import { cn } from "@/lib/utils";

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, id, error, className, placeholder, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            placeholder=" "
            className={cn(
              "peer h-12 w-full rounded-lg border bg-background px-3.5 pt-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder-transparent",
              "focus:border-primary focus:ring-2 focus:ring-primary/20",
              error
                ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                : "border-input",
              className,
            )}
            aria-invalid={!!error}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              "pointer-events-none absolute left-3.5 top-3.5 text-sm text-muted-foreground transition-all",
              "peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm",
              "peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary",
              "peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs",
            )}
          >
            {label}
          </label>
        </div>
        {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);
FloatingInput.displayName = "FloatingInput";
