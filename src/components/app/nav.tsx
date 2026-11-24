"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, Radar, MessagesSquare, Settings2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const items = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campanhas", icon: Radar },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/messages", label: "Mensagens", icon: MessagesSquare },
  { href: "/settings", label: "Integrações", icon: Settings2 },
];

export function Sidebar({ email, workspace }: { email: string | null; workspace: string }) {
  const path = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-[#0b100c]/80 px-3 py-5 backdrop-blur md:flex">
        <Link href="/dashboard" className="px-3"><Logo className="text-lg" /></Link>
        <p className="mt-1 truncate px-3 text-xs text-muted">{workspace}</p>
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Principal">
          {items.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-primary/10 text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
                <Icon className="size-4" />{label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border px-3 pt-4">
          <p className="truncate text-xs text-muted">{email}</p>
          <form action="/auth/signout" method="post"><button className="mt-2 flex items-center gap-2 text-xs text-muted hover:text-foreground"><LogOut className="size-3.5" />Sair</button></form>
        </div>
      </aside>
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-primary-strong" : "text-muted")}>
              <Icon className="size-5" />{label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
