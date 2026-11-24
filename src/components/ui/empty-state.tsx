import type { LucideIcon } from "lucide-react";
import * as React from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
      <div className="grid size-11 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary-strong"><Icon className="size-5" /></div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
