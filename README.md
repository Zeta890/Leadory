# Leadory

Plataforma SaaS de prospecção comercial: descobre empresas locais por nicho, região e raio, audita a presença online, calcula um Lead Score, gera prévias de site e mensagens personalizadas, e gerencia o pipeline em um CRM Kanban. O envio pelo WhatsApp Cloud API só acontece com consentimento verificável e aprovação humana.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · componentes no padrão shadcn/ui (Radix) · Recharts · Lucide · dnd-kit · Supabase (Auth + Postgres com RLS) · Vitest.

> O piloto estático original está em `legacy/` (`index.html` e `schema.sql`) como referência. Todas as funcionalidades dele foram preservadas: dashboard, gráfico de captação, configuração de campanha, cadastro manual com deduplicação, CRM com mudança de etapa e busca.

## Módulos

| Módulo | Onde | O que faz |
|---|---|---|
| Domínio | `src/lib/domain/` | Funções puras: Haversine, normalização e dedupe, Lead Score, decisão de status de site, mensagens, prévia, regras do WhatsApp. Sem I/O. |
| Descoberta | `src/lib/discovery/` | Interface `DiscoveryProvider`, Google Places (New) Text Search, busca web (Brave) e o motor de campanha. |
| Serviços | `src/lib/services/` | Ligam domínio e banco: executar campanha, auditar lead, recalcular score, gerar mensagem (IA opcional), elegibilidade de envio, consentimento, envio WhatsApp. |
| API | `src/app/api/` | Rotas server-only com validação zod, checagem de posse do recurso e CSRF por Origin. |
| UI | `src/app/(app)/`, `src/components/` | Dashboard, Campanhas, CRM, Lead, Mensagens, Integrações. |
| Banco | `supabase/migrations/` | Schema multi-tenant com RLS, triggers de integridade e de guarda de envio. |

Cada módulo pode ser trocado sem tocar nos outros (por exemplo, outro provedor de descoberta implementa `DiscoveryProvider`).

## Primeira campanha

Em **Campanhas → Nova campanha** o formulário já vem configurado:

- Clínicas odontológicas em Florianópolis, SC, centro `-27.5954, -48.5480`
- Raio de 50 km (distância real calculada por Haversine; resultados fora do raio são descartados)
- Até 100 empresas únicas (dedupe por place_id, telefone normalizado e nome+endereço)
- Prioriza empresas sem site na fonte; telefone comercial obrigatório; Instagram opcional
- 12 variações de consulta (Florianópolis, São José, Palhoça, Biguaçu, bairros e especialidades) e teto de 60 requisições

Fluxo: **Salvar campanha → Iniciar descoberta → Auditar presença online**. Sem `GOOGLE_PLACES_API_KEY` o botão fica desabilitado e nada é simulado. Sem `BRAVE_SEARCH_API_KEY`, empresas sem site na fonte ficam como *Inconclusivo* até você validar manualmente.

## Configuração

1. **Supabase** — crie um projeto dedicado e aplique as migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push            # aplica supabase/migrations/*
   ```
   Em Authentication → URL Configuration, adicione `APP_URL/auth/callback` aos redirects.
2. **Variáveis** — copie `.env.example` para `.env.local` e preencha. Só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` chegam ao navegador; todas as outras chaves ficam no servidor.
3. **Rodar**
   ```bash
   npm ci
   npm run dev       # http://localhost:3000
   npm test          # Vitest (domínio, banco/RLS via PGlite, rotas)
   npm run typecheck
   npm run build
   ```
4. **WhatsApp (opcional)** — no app da Meta, configure o webhook para `APP_URL/api/webhooks/whatsapp` com o `WHATSAPP_VERIFY_TOKEN` e assine `messages`. Cadastre um template aprovado em Integrações para mensagens fora da janela de 24h. Depois habilite o envio no workspace.
5. **Fila** — `vercel.json` agenda `/api/cron/dispatch` (a cada 10 min, seg–sex, horário comercial) e `/api/cron/retention` (diário). Defina `CRON_SECRET`. Fora da Vercel, chame as rotas com `Authorization: Bearer $CRON_SECRET`. Observação: no plano Hobby da Vercel, crons rodam no máximo uma vez por dia; use Pro ou um agendador externo para a fila.

Enquanto o Supabase não estiver configurado, o app mostra `/setup` com o status de cada integração.

## Segurança

- **RLS em todas as tabelas**, com isolamento por workspace (`is_member`) e exclusão restrita a owner/admin. Histórico e auditorias são append-only. `webhook_events` só é acessível pela service role.
- **Integridade de tenant**: triggers impedem vincular lead, mensagem, prévia ou consentimento a um registro de outro workspace.
- **Secrets só no servidor**: `server-only` em todos os módulos que leem chaves; a tela de Integrações mostra apenas se cada chave está configurada.
- **SSRF**: a auditoria só busca http/https nas portas 80/443, recusa credenciais na URL e hosts internos, e valida o IP *no momento da conexão* (proteção contra DNS rebinding), com limite de 1 MB, 8 s e 3 redirecionamentos. O HTML externo é tratado como dado não confiável (extração por regex, nada é executado).
- **IA**: dados do lead vão delimitados e marcados como não confiáveis; a saída passa pelo mesmo validador da mensagem manual e, se reprovada, cai no modelo aprovado.
- **CSRF**: rotas autenticadas por cookie exigem `Origin` do próprio host em métodos mutáveis.
- **Webhook**: assinatura `X-Hub-Signature-256` (HMAC-SHA256, comparação em tempo constante) e idempotência por ID de evento.
- **CSV**: proteção contra injeção de fórmulas.

## Conformidade (WhatsApp, dados e LGPD)

- **Envio desabilitado por padrão.** Para agendar, a mensagem precisa de: opt-in registrado com evidência (mínimo de 10 caracteres descrevendo canal, data e quem autorizou), aprovação humana, envio habilitado no workspace, número fora da lista de supressão e template quando fora da janela de 24h. As regras valem na API e também em um trigger no banco.
- **A etapa "Autorizado" do CRM não é prova de consentimento.** Consentimento é um registro separado e revogável.
- Janela de envio: seg–sex, 9h–17h, America/Sao_Paulo. Retries limitados (3 tentativas, backoff de 5, 20 e 80 min). Fila idempotente.
- Qualquer resposta do contato cancela pendências. Pedidos para sair ("sair", "parar", "não tenho interesse"…) revogam o consentimento e suprimem o número.
- Telefone comercial não é tratado como WhatsApp, e não encontrar um site não prova que ele não exista: o estado padrão é **Inconclusivo** até que a busca rode de fato ou alguém valide manualmente.
- **Google Places**: só `place_id` é mantido indefinidamente. Os demais campos têm `source_expires_at` de 30 dias e são expirados pelo cron de retenção. A exportação CSV omite conteúdo derivado do Places.
- Prévias de site são conceituais, `noindex`, expiram em 60 dias, trazem aviso de demonstração e usam só dados conhecidos (lacunas aparecem como campos a confirmar).
- Dados simulados, se existirem, ficam marcados com `is_simulated` e são excluídos das métricas.

## Testes

`npm test` roda 98 testes:

- **Domínio** — raio de 50 km (inclui Palhoça e exclui Itajaí/Blumenau), normalização de telefone, dedupe, score, SSRF, estado inconclusivo, mensagens (limite, prévia inexistente, promessas), prévia sem informação inventada.
- **Descoberta** — 100 empresas únicas com duplicatas, filtros de raio/telefone/fechadas, prioridade sem site, falha transitória e fatal da API, orçamento de requisições, reexecução sem duplicar.
- **WhatsApp** — janela de envio e fuso, retries, elegibilidade (sem opt-in, revogado, supressão, sem aprovação, template), assinatura e parse do webhook, opt-out.
- **Banco (PGlite, Postgres real em WASM)** — migration completa, isolamento entre dois usuários, acesso anon negado, troca de workspace bloqueada, FKs entre tenants, limites de raio e quantidade, telefone único, guarda de agendamento, idempotência, limite de 350 caracteres, histórico append-only.
- **Rotas** — verificação do webhook, assinatura inválida, cron sem segredo, CSRF e 401 sem sessão.
- **Métricas** — fuso de São Paulo, semana iniciando na segunda, zeros sem dados, receita realizada separada da estimada.

A interface foi verificada em 390 px e 1440 px (sem rolagem horizontal) e o Kanban foi testado por teclado e por seletor, incluindo o rollback quando a API falha.

**Ainda não testado ponta a ponta**: o fluxo completo contra um Supabase real, Google Places, Brave e a Meta, porque dependem de projeto e chaves que precisam ser configurados.

## Deploy

Vercel: importe o repositório, defina as variáveis de `.env.example` e faça o deploy. O Supabase hospeda banco e auth; o GitHub guarda o código.
