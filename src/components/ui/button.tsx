import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-strong shadow-[0_0_0_1px_rgb(16_185_129/0.4),0_8px_24px_-8px_rgb(16_185_129/0.5)]",
        outline: "border border-border-strong bg-surface hover:border-primary/60 hover:bg-surface-2",
        ghost: "hover:bg-surface-2 text-muted hover:text-foreground",
        danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
      },
      size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", lg: "h-11 px-6", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
