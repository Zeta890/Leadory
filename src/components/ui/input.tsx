import * as React from "react";
import { cn } from "@/lib/utils";

const field = "w-full rounded-lg border border-border-strong bg-background/60 px-3 text-sm placeholder:text-muted/70 transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-10", className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-24 py-2", className)} {...p} />;
}
export function NativeSelect({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", className)} {...p} />;
}
