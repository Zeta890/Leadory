import { formatPhoneBR } from "./normalize";

export interface PreviewInput {
  businessName: string;
  address: string | null;
  phoneE164: string | null;
  city: string;
  /** Especialidades confirmadas (fonte ou humano). Nunca inventadas. */
  confirmedServices: string[];
  instagram: string | null;
}

export interface PreviewSection { kind: "hero" | "services" | "contact" | "location" | "disclaimer"; title: string; body: string[] }

export interface PreviewDocument {
  title: string;
  sections: PreviewSection[];
  /** Campos deixados como placeholder explícito — o cliente deve fornecer. */
  placeholders: string[];
}

/** Gera uma prévia conceitual usando somente dados conhecidos. Lacunas viram placeholders rotulados. */
export function buildPreview(p: PreviewInput): PreviewDocument {
  const placeholders: string[] = [];
  const services = p.confirmedServices.filter(Boolean);
  if (services.length === 0) placeholders.push("Tratamentos oferecidos");
  if (!p.address) placeholders.push("Endereço");
  if (!p.phoneE164) placeholders.push("Telefone");
  placeholders.push("Fotos da clínica e da equipe", "Horário de atendimento", "Responsável técnico (CRO)");

  const sections: PreviewSection[] = [
    { kind: "hero", title: p.businessName, body: [`Atendimento odontológico em ${p.city}.`, "Agende sua avaliação."] },
    {
      kind: "services",
      title: "Tratamentos",
      body: services.length ? services : ["[A clínica informará seus tratamentos]"],
    },
    {
      kind: "contact",
      title: "Agendamento",
      body: [p.phoneE164 ? `Telefone: ${formatPhoneBR(p.phoneE164)}` : "[Telefone a confirmar]", ...(p.instagram ? [`Instagram: @${p.instagram}`] : [])],
    },
    { kind: "location", title: "Onde estamos", body: [p.address ?? "[Endereço a confirmar]"] },
    {
      kind: "disclaimer",
      title: "Prévia conceitual",
      body: ["Esta é uma demonstração não oficial, criada para apresentação comercial. Não é indexada por buscadores e não representa o site da empresa."],
    },
  ];
  return { title: `${p.businessName} — prévia conceitual`, sections, placeholders };
}
