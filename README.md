# Leadory
Plataforma piloto de prospecção e CRM. Design preto e verde.

## Executar
- Clone o repositório e execute `python -m http.server 8000` na raiz.
- Abra http://localhost:8000/index.html para demonstração local.
- Abra http://localhost:8000/cloud.html para o piloto conectado ao Supabase.
- Use somente a chave publishable moderna do projeto AURA ONE - CNC e uma conta existente autorizada. Não informe service_role. Para uso remoto, hospede em HTTPS confiável. Não há cadastro automático, e a sessão fica em memória; ao expirar, entre novamente.
- Não inserir dados comerciais reais até validar políticas do provedor e realizar teste ponta a ponta.

## Backend aplicado em 24/11/2026
O projeto dedicado foi bloqueado pelo limite de projetos gratuitos. Com autorização do proprietário, foi usada a infraestrutura AURA ONE - CNC. Apenas duas tabelas novas foram criadas: public.leadory_campaigns e public.leadory_leads. O arquivo supabase/shared-schema.sql registra a migration aplicada; NÃO reaplique no banco atual. O arquivo supabase/schema.sql é apenas referência para projeto independente. Auth, quotas e infraestrutura são compartilhados; RLS por usuário não representa isolamento físico nem separação de identidade entre aplicações. Não modificar objetos preexistentes sem autorização.

## Validação
Verificados: presença das 15 tabelas anteriores e suas contagens, RLS, permissões anon/authenticated, leitura e inserção pelo proprietário, bloqueio de leitura e atualização por outro usuário, FK cruzada, raio inválido, duplicação de telefone idêntico. Teste transacional revertido; tabelas Leadory vazias. Security Advisor não apontou problemas específicos nas novas tabelas, mas apontou avisos no projeto compartilhado (funções SECURITY DEFINER, extensão em public e proteção contra senhas vazadas desativada). Não alterados. Testes de navegador, autenticação HTTP e CRUD pela interface pendentes. Limite de 100 registros por campanha ainda não é imposto no banco, apenas o campo de configuração está validado. Nenhum envio ou prospecção automática está ativo.

## Claude
Leia CLAUDE.md e docs/backend-validation.md; prevalece a configuração compartilhada descrita neste README. Evolua cloud.html para Next.js com cliente oficial, gestão segura de sessão, isolamento por workspace e autorização específica do produto, mantendo o design do index.html. Não execute migrations em tabelas existentes. Não implemente envio sem consentimento, aprovação e política da plataforma. Configure APIs e testes antes da produção.
