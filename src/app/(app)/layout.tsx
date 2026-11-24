import { requireCtx } from "@/lib/session";
import { Sidebar } from "@/components/app/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const { data: ws } = await ctx.supabase.from("workspaces").select("name").eq("id", ctx.workspaceId).single();
  return (
    <div className="flex min-h-dvh">
      <Sidebar email={ctx.email} workspace={ws?.name ?? ""} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
