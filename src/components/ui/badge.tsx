import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", {
  variants: {
    tone: {
      neutral: "border-border-strong bg-surface-2 text-muted",
      success: "border-primary/40 bg-primary/10 text-primary-strong",
      warning: "border-warning/40 bg-warning/10 text-warning",
      danger: "border-danger/40 bg-danger/10 text-danger",
      info: "border-info/40 bg-info/10 text-info",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
