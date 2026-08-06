import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "ui-input flex h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-base text-foreground placeholder:text-muted-foreground/75 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
