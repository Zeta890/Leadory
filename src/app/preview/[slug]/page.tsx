import { notFound } from "next/navigation";
import { Phone, MapPin, Stethoscope, Info } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PreviewDocument } from "@/lib/domain/preview";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false, nocache: true } };

/** Prévia conceitual pública (não indexada). Somente prévias publicadas e não expiradas. */
export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-f0-9]{24}$/.test(slug)) notFound();
  const sb = createAdminClient();
  if (!sb) notFound();
  const { data } = await sb.from("previews").select("content, status, expires_at").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) notFound();
  const doc = data.content as PreviewDocument;
  const sec = (k: string) => doc.sections.find((s) => s.kind === k);
  const hero = sec("hero"), services = sec("services"), contact = sec("contact"), location = sec("location"), disclaimer = sec("disclaimer");
  return (
    <div className="min-h-dvh bg-[#f7faf8] text-[#0b1a12]">
      <div className="flex items-center gap-2 bg-[#0b1a12] px-4 py-2 text-xs text-[#d1fae5]"><Info className="size-3.5" />{disclaimer?.body[0]}</div>
      <header className="mx-auto max-w-5xl px-6 pb-16 pt-20">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">Odontologia</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{hero?.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-[#365443]">{hero?.body.join(" ")}</p>
        {contact && <a href="#contato" className="mt-8 inline-flex rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800">Agendar avaliação</a>}
      </header>
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Stethoscope className="size-5 text-emerald-700" />{services?.title}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">{services?.body.map((s) => <li key={s} className="rounded-2xl border border-emerald-900/10 bg-white p-5 text-sm shadow-sm">{s}</li>)}</ul>
      </section>
      <section id="contato" className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm"><h3 className="flex items-center gap-2 font-semibold"><Phone className="size-4 text-emerald-700" />{contact?.title}</h3>{contact?.body.map((b) => <p key={b} className="mt-2 text-sm text-[#365443]">{b}</p>)}</div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-emerald-700" />{location?.title}</h3>{location?.body.map((b) => <p key={b} className="mt-2 text-sm text-[#365443]">{b}</p>)}</div>
      </section>
    </div>
  );
}
