import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button relative isolate inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[-0.01em] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-violet-grad text-primary-foreground shadow-card hover:border-white/20 hover:shadow-elevated",
        destructive:
          "border-destructive/25 bg-destructive text-destructive-foreground shadow-card hover:border-destructive/40 hover:bg-destructive/90",
        outline:
          "border-white/[0.09] bg-white/[0.035] text-foreground shadow-card backdrop-blur-xl hover:border-primary/30 hover:bg-white/[0.065]",
        secondary:
          "border-white/[0.07] bg-secondary text-secondary-foreground shadow-card hover:border-white/[0.12] hover:bg-secondary/85",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-foreground",
        link:
          "border-transparent bg-transparent p-0 text-accent shadow-none underline-offset-4 hover:text-accent/85 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-sm",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
