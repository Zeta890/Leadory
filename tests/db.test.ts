import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db: PGlite;
let wsA: string, wsB: string;

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    if (user) {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
      await tx.exec("set local role authenticated");
    } else await tx.exec("set local role anon");
    return (await tx.query<T>(sql, params)).rows;
  });
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  for (const f of readdirSync(path.join(root, "supabase/migrations")).sort())
    await db.exec(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
  await db.query(`insert into auth.users(id,email) values ($1,'a@x.com'),($2,'b@x.com')`, [A, B]);
  wsA = (await db.query<{ workspace_id: string }>(`select workspace_id from workspace_members where user_id=$1`, [A])).rows[0]!.workspace_id;
  wsB = (await db.query<{ workspace_id: string }>(`select workspace_id from workspace_members where user_id=$1`, [B])).rows[0]!.workspace_id;
}, 60_000);

describe("migrations + RLS", () => {
  it("cria workspace pessoal com owner no signup, envio desabilitado", async () => {
    const r = await as<{ sending_enabled: boolean }>(A, "select sending_enabled from workspaces");
    expect(r).toHaveLength(1);
    expect(r[0]!.sending_enabled).toBe(false);
  });

  it("isolamento: B não lê nem altera dados de A", async () => {
    await as(A, `insert into leads(workspace_id,name,phone_e164) values ($1,'Clínica A','+554832221234')`, [wsA]);
    expect(await as(B, "select * from leads")).toHaveLength(0);
    expect(await as(A, "select * from leads")).toHaveLength(1);
    const upd = await as(B, "update leads set name='hack' returning id");
    expect(upd).toHaveLength(0);
    await expect(as(B, `insert into leads(workspace_id,name) values ($1,'x')`, [wsA])).rejects.toThrow(/row-level security/);
  });

  it("anon não acessa nada", async () => {
    await expect(as(null, "select * from leads")).rejects.toThrow(/permission denied/);
  });

  it("B não move lead próprio para workspace de A", async () => {
    await as(B, `insert into leads(workspace_id,name) values ($1,'Clínica B')`, [wsB]);
    await expect(as(B, `update leads set workspace_id=$1`, [wsA])).rejects.toThrow(/row-level security/);
  });

  it("não vincula lead a campanha de outro workspace", async () => {
    const [c] = await as<{ id: string }>(A, `insert into campaigns(workspace_id,name,niche,city,center_lat,center_lng,radius_km,max_companies) values ($1,'c','n','x',-27.5,-48.5,50,100) returning id`, [wsA]);
    await expect(as(B, `insert into leads(workspace_id,campaign_id,name) values ($1,$2,'x')`, [wsB, c!.id])).rejects.toThrow(/outro workspace/);
  });

  it("restrições da campanha: raio ≤ 50 e limite ≤ 100", async () => {
    await expect(as(A, `insert into campaigns(workspace_id,name,niche,city,center_lat,center_lng,radius_km,max_companies) values ($1,'c','n','x',0,0,51,100)`, [wsA])).rejects.toThrow(/check/);
    await expect(as(A, `insert into campaigns(workspace_id,name,niche,city,center_lat,center_lng,radius_km,max_companies) values ($1,'c','n','x',0,0,50,101)`, [wsA])).rejects.toThrow(/check/);
  });

  it("telefone único por workspace (dedupe no banco)", async () => {
    await expect(as(A, `insert into leads(workspace_id,name,phone_e164) values ($1,'dup','+554832221234')`, [wsA])).rejects.toThrow(/duplicate key/);
    // outro workspace pode ter o mesmo telefone
    await as(B, `insert into leads(workspace_id,name,phone_e164) values ($1,'ok','+554832221234')`, [wsB]);
  });

  it("agendamento exige aprovação, opt-in, envio habilitado e não-supressão", async () => {
    const [lead] = await as<{ id: string }>(A, `select id from leads where name='Clínica A'`);
    const ins = (status: string, approved: boolean) =>
      as(A, `insert into messages(workspace_id,lead_id,direction,body,status,approved_by,approved_at) values ($1,$2,'outbound','Olá! Posso te mostrar?',$3,$4,$5)`, [wsA, lead!.id, status, approved ? A : null, approved ? new Date().toISOString() : null]);
    await ins("draft", false); // rascunho OK
    await expect(ins("scheduled", false)).rejects.toThrow(/aprovação humana/);
    await expect(ins("scheduled", true)).rejects.toThrow(/opt-in/);
    await expect(as(A, `insert into consents(workspace_id,lead_id,phone_e164,evidence,source) values ($1,$2,'+554832221234','curta','other')`, [wsA, lead!.id])).rejects.toThrow(/check/);
    await as(A, `insert into consents(workspace_id,lead_id,phone_e164,evidence,source) values ($1,$2,'+554832221234','Contato enviou mensagem pedindo proposta em 20/11','inbound_message')`, [wsA, lead!.id]);
    await expect(ins("scheduled", true)).rejects.toThrow(/desabilitado/);
    await as(A, `update workspaces set sending_enabled=true where id=$1`, [wsA]);
    await ins("scheduled", true);
    await as(A, `insert into suppression_list(workspace_id,phone_e164,reason) values ($1,'+554832221234','opt-out')`, [wsA]);
    await expect(ins("scheduled", true)).rejects.toThrow(/suprimido/);
  });

  it("idempotência: mesma chave não cria duas mensagens", async () => {
    const [lead] = await as<{ id: string }>(A, `select id from leads where name='Clínica A'`);
    const q = `insert into messages(workspace_id,lead_id,direction,body,idempotency_key) values ($1,$2,'outbound','Olá?','k1')`;
    await as(A, q, [wsA, lead!.id]);
    await expect(as(A, q, [wsA, lead!.id])).rejects.toThrow(/duplicate key/);
  });

  it("mensagem outbound livre limitada a 350 caracteres", async () => {
    const [lead] = await as<{ id: string }>(A, `select id from leads where name='Clínica A'`);
    await expect(as(A, `insert into messages(workspace_id,lead_id,direction,body) values ($1,$2,'outbound',$3)`, [wsA, lead!.id, "a".repeat(351)])).rejects.toThrow(/check/);
  });

  it("histórico é append-only para membros", async () => {
    const [lead] = await as<{ id: string }>(A, `select id from leads where name='Clínica A'`);
    await as(A, `insert into lead_events(workspace_id,lead_id,type) values ($1,$2,'note')`, [wsA, lead!.id]);
    expect(await as(A, `update lead_events set type='x' returning id`)).toHaveLength(0);
  });

  it("member comum não exclui; usuário sem vínculo não vê webhook_events", async () => {
    await expect(as(A, "select * from webhook_events")).rejects.toThrow(/permission denied/);
  });
});
