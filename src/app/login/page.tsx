import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Logo className="text-2xl" />
          <p className="text-sm text-muted">Prospecção comercial com dados licenciados e comunicação consentida.</p>
        </div>
        <LoginForm next={sp.next} initialError={sp.error ? "Sessão inválida. Entre novamente." : undefined} />
      </div>
    </main>
  );
}
