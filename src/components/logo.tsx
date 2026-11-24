import { cn } from "@/lib/utils";
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden className="grid size-[1.4em] place-items-center rounded-md bg-primary text-[0.7em] font-bold text-primary-foreground shadow-[0_0_20px_-4px_rgb(16_185_129/0.8)]">L</span>
      leadory<span className="text-primary">.</span>
    </span>
  );
}
