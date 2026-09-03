# Status de implementação

> Documento gerado para dar visibilidade do que já foi construído no repositório,
> a partir do PRD (**referência vigente: v1.7** — não alterado por este
> arquivo nem pelo trabalho descrito aqui). Reflete o estado da branch
> `claude/criar-telas-prd-78u21w` até o PR #15 (ajustes de layout de
> Clientes) mais o trabalho de RF13 (Gestão Unificada de Contatos) descrito
> abaixo, ainda em PR aberto no momento deste registro.
>
> **Com RF06 e RF01 fechados, todos os requisitos funcionais do MVP
> (RF01–RF11) estão implementados e ligados a dados reais** — RF12 segue
> intencionalmente fora do MVP (Fase 4). O que resta em aberto (seção
> "Pontos em Aberto" da v1.6) não é mais código a construir: revisão
> jurídica do texto de consentimento LGPD, migração dos clientes reais
> existentes para o sistema, fluxo de onboarding de novo tenant (só
> quando a revenda começar) e a divergência `staff_availability`/
> `staff_time_blocks` (bloqueia só uma fase futura do RF06, não o MVP).
>
> **RF13 (Gestão Unificada de Contatos)** não faz parte das 12 telas
> originais do PRD v1.3. Foi solicitada pelo usuário como tela nova
> (`/contatos`) a partir de uma referência visual, e existe hoje como
> rascunho aprovado em sessão de deliberação (fora deste ambiente) — ainda
> **não formalizada** no documento oficial do PRD. A formalização como
> requisito funcional fica para uma v1.8, depois que esta implementação
> for validada.

## Resumo por tela

| # | Tela / RF | Status | Onde |
|---|---|---|---|
| 1 | Login, Dashboard, Gestão de Equipe, Recuperação de senha | ✅ Real | `src/routes/login.tsx`, `esqueci-senha.tsx`, `nova-senha.tsx`, `equipe.tsx` |
| 2 | Dashboard / Home | ✅ Real | `src/routes/index.tsx` |
| 3 | Módulo de Clientes (lista + detalhe) | ✅ Real | `src/routes/clientes/` |
| 4 | Detalhe do Cliente (documentos, contatos, contexto) | ✅ Real | `src/routes/clientes/$clienteId.tsx` |
| 5 | Inbox de Conversas | ✅ Real | `src/routes/conversas/index.tsx` |
| 6 | Agenda | ✅ Real | `src/routes/agenda/index.tsx` |
| 7 | Funil de Leads | ✅ Real | `src/routes/leads/index.tsx` |
| — | Contatos (RF13 — Gestão Unificada, fora das 12 telas originais) | ✅ Real | `src/routes/contatos/index.tsx` |
| — | Integrações WhatsApp/IA, Base de Conhecimento, Consentimento, Templates, Agente de IA | ✅ Real | `src/routes/configuracoes/index.tsx` |
| 9 | Relatórios e Métricas | ⚠️ Real, exceto CSAT (ver gaps) | `src/routes/relatorios/index.tsx` |
| — | Motor de atendimento por IA (orquestrador + 9 ferramentas) | ✅ Real (OpenAI) | `src/lib/agent/` |
| — | Webhook do WhatsApp (recebimento de mensagens) | ✅ Real | `src/server.ts`, `src/lib/integrations/whatsapp/` |
| — | Copiloto interno (RF11 — resumir / sugerir resposta) | ✅ Real | `src/components/common/copilot-widget.tsx`, `src/lib/copilot-actions.ts` |
| — | RAG semântico sobre PDFs da Base de Conhecimento (RF07) | ✅ Real | `src/lib/knowledge-base/` |
| — | Overflow de escalonamento (RF05) | ✅ Real (job agendado) | `supabase/migrations/20260902200000_escalation_overflow_job.sql` |
| — | Lembrete automático de compromisso (RF06) | ✅ Real (job via cron externo) | `src/lib/jobs/appointment-reminders.server.ts` |

Todas as telas do painel estão ligadas a dados reais do Supabase — não há
mais nenhuma tela rodando sobre `mock-data.ts` (o arquivo hoje só guarda o
tipo `DocStatus`/`statusLabel`, compartilhado entre telas de clientes).

## Decisão de provedor de IA

O projeto está em **OpenAI** (`gpt-5-mini` por padrão, configurável por
tenant entre `gpt-5-mini`/`gpt-5`/`gpt-5-nano`), decisão do usuário
registrada como v1.5 do PRD. Chat completions e embeddings passam pela
mesma interface plugável (`AiProvider`), então trocar de provedor no
futuro não exige reescrever o motor de atendimento nem o copiloto.

## Histórico de entrega (pull requests)

| PR | O que entrou |
|---|---|
| #1 | As 12 telas do painel, com dados fictícios (`mock-data.ts`) |
| #2 | Schema estrutural multi-tenant (tenants, staff, departments, clients) + RLS |
| #3 | Autenticação real (login, convite, redefinição de senha) |
| #4 | Módulo de Clientes ligado a dados reais |
| #5 | Agenda e Leads ligados a dados reais |
| #6 | Integrações WhatsApp/IA (schema, camada plugável, UI de configuração) |
| #7 | Agente de IA, Base de Conhecimento, Consentimento e Templates ligados a dados reais |
| #8 | Schema de conversas e orquestração do agente (`conversations`, `messages`, `escalations`, `agent_conversation_state`, `staff_copilot_interactions`) |
| #9 | Webhook que recebe mensagens do WhatsApp (RF03) |
| #10 | Motor de atendimento completo: troca para OpenAI, orquestrador real (`runAgentTurn`, 9 ferramentas), correções de fuso horário e do gate de consentimento |
| #11 | Job agendado (`pg_cron`) que preenche `escalations.is_overflow` (RF05) |
| #12 | RAG semântico (RF07), Copiloto interno com IA real (RF11), Inbox de Conversas com dados reais (Tela 5), Dashboard e Relatórios com dados reais (Telas 2 e 9) |
| #13 | Lembrete automático de compromisso via WhatsApp (RF06) |
| #14 | Ajuste de configuração (TTL do OTP de e-mail, RF01) documentado |
| #15 | Ajustes de layout da tela de Clientes |
| #16 | Fechado sem merge — primeira versão da tela de Contatos tinha problema de arquitetura (exclusão física apagava histórico de conversas via cascade); substituído pelo #17 abaixo |
| #17 | Reconstrução da tela de Contatos como fonte única de gestão (`/contatos`), com arquivamento em vez de exclusão física quando há histórico, mais trigger de defesa em profundidade no banco |

## O que o PR #12 adicionou, em detalhe

- **RAG semântico (RF07)** — pipeline de ingestão
  (`src/lib/knowledge-base/ingest.server.ts`) extrai texto de PDFs via
  `unpdf` (compatível com o runtime Cloudflare Workers do deploy), quebra em
  pedaços de ~1500 caracteres e gera embeddings via OpenAI
  (`text-embedding-3-small`), gravados em `knowledge_base_chunks`
  (`vector(1536)`, índice HNSW). `search_knowledge_base` agora combina a
  busca lexical existente sobre o FAQ com a busca semântica por
  similaridade de cosseno.
- **Copiloto interno (RF11)** — "Resumir conversa" e "Sugerir resposta"
  chamam a OpenAI de verdade (antes era um mock com `setTimeout`), cada uso
  registrado em `staff_copilot_interactions`; a equipe decide
  aceitar/editar/descartar, e o rascunho nunca é enviado sozinho.
- **Inbox de Conversas (Tela 5)** — a fila de escalonamento
  (`escalations` não resolvidas), o histórico de mensagens
  (`messages`) e o "assumir conversa" passam a ser dados reais.
  Responder de verdade dispara `sendConversationReply`
  (`src/lib/conversation-actions.ts`), que envia pela Meta Cloud API e só
  então grava a mensagem no histórico.
- **Dashboard e Relatórios (Telas 2 e 9)** — o widget de "conversas na
  fila" (Dashboard) e o badge da barra lateral usam a mesma fila real da
  Tela 5. Relatórios ganhou 4 métricas históricas reais (tempo até 1ª
  resposta, % resolvido só pela IA, % documentos no prazo, conversão de
  leads em reuniões), calculadas por functions SQL
  (`supabase/migrations/20260902250000_report_metrics.sql`).

## Lembrete automático de compromisso (RF06) — PR #13, mergeado

> Fecha uma das duas pendências que a v1.6 do PRD reclassificou como
> bloqueio de Fase 1 (a outra é a checagem de conflito de agenda, que já
> estava implementada desde o PR #5 via a constraint
> `appointments_no_overlap_per_staff` — a v1.6 do PRD listava isso como
> "não confirmado", mas o código já resolvia).
>
> **Revisão:** o primeiro commit deste trabalho tinha uma falha silenciosa —
> quando o envio via WhatsApp falhava, o job gravava a mensagem no
> histórico como se tivesse sido entregue e marcava o compromisso como
> processado de qualquer forma, sem nunca tentar de novo. Corrigido: o job
> só marca o compromisso como processado quando o envio realmente dá
> certo para todos os destinatários; em caso de falha real, ele continua
> elegível e é tentado de novo na próxima execução do cron, até o horário
> do compromisso passar.

- **O que faz:** varre `appointments` futuros sem `reminder_sent_at`, dentro
  de uma janela fixa de 24h antes do início, e envia uma mensagem de
  WhatsApp para cada contato vinculado ao cliente (ou ao lead) do
  compromisso — reaproveitando `findOrCreateConversation` do webhook
  (`meta-cloud-webhook.server.ts`) para registrar a mensagem no histórico da
  conversa como qualquer outra.
- **Por que não é um job pg_cron como o overflow do RF05:** enviar de
  verdade depende de resolver o `WhatsAppProvider` e os segredos do tenant
  (`tenant_integration_secrets`), algo que só o runtime da aplicação faz —
  SQL puro dentro do Postgres não tem acesso a isso. Em vez disso, é um
  endpoint HTTP (`POST /api/cron/appointment-reminders`, interceptado em
  `src/server.ts`) autenticado por segredo compartilhado
  (`authenticateCronRequest`/`LOVABLE_CRON_SECRET`, já gerado no projeto e
  até agora sem nenhum endpoint usando).
- **Pendência operacional (fora do código):** falta cadastrar, no
  agendador externo (Lovable Cloud Cron), uma chamada periódica (sugestão:
  a cada 15–30 min) para essa URL com o segredo configurado — isso não é
  feito por migration nem por código, é configuração de painel, no mesmo
  espírito de "URL do webhook cadastrada no painel da Meta" já exigido pelo
  RF03.

## Expiração de link de convite/recuperação de senha (RF01) — fechado

> A outra pendência que a v1.6 do PRD reclassificou como bloqueio de Fase 1.

`nova-senha.tsx` tem um estado dedicado de "Link expirado" (se a sessão
não se estabelece a partir do token da URL em alguns segundos, mostra a
tela de link expirado com CTA para solicitar um novo), e `esqueci-senha.tsx`
já evita enumeração de e-mail e informa "o link expira em 24 horas". O TTL
real (Authentication → Email → "Tempo de expiração do OTP por e-mail",
painel do Lovable Cloud/Supabase Auth) estava em 3600s (1h) — descompasso
com o que a tela prometia — e foi ajustado para 86400s (24h), fechando o
requisito de ponta a ponta (código + configuração).

## Gestão Unificada de Contatos (RF13) — `/contatos`

> Não é uma das 12 telas originais do PRD v1.3; foi pedida pelo usuário
> como ajuste de layout/visualização a partir de uma referência `.tsx`
> anexada. RF13 existe hoje como rascunho aprovado em sessão de
> deliberação (fora deste ambiente), ainda **não formalizado** no
> documento oficial do PRD — a formalização fica para uma v1.8, depois
> que esta implementação for validada. Um primeiro recorte (PR #16) foi
> fechado sem merge por um problema de arquitetura: exclusão física de
> contato cascateava para `conversations`/`consent_log`
> (`on delete cascade`), apagando histórico de atendimento e prova de
> consentimento LGPD sem aviso algum.

- **Correção principal — arquivamento condicional em vez de exclusão
  sempre física:** `contacts.archived_at` (nullable). Antes de excluir,
  o app verifica se existe alguma `conversations.contact_id` para aquele
  contato — se existir, só "Arquivar" fica disponível (preserva
  histórico e consentimento); se não existir nenhuma conversa, a
  exclusão física é permitida (contato cadastrado por engano, sem
  histórico). Contato arquivado pode ser reativado. Validado
  manualmente contra o banco real: exclusão física sem histórico,
  bloqueio+arquivamento com histórico, e reativação — os três cenários
  conferidos direto no Postgres antes de considerar o requisito fechado.
- **Defesa em profundidade no banco:** a checagem acima existia só na UI
  na primeira revisão do PR — RLS (`contacts_all_same_tenant`) sozinha
  permite a qualquer staff do tenant excluir qualquer contato, então nada
  impedia reproduzir o mesmo problema do PR #16 por uma chamada direta à
  API, um bug futuro, ou uma tela nova que esquecesse de checar
  `hasHistory`. Trigger `contacts_block_delete_with_history`
  (`before delete on contacts`) bloqueia a exclusão física no próprio
  banco sempre que existir `conversations.contact_id` para o contato,
  mesmo padrão já usado para outras invariantes do schema
  (`check_conversation_tenant`, `check_document_submission_tenant`,
  `check_client_contact_link_same_tenant`). Validado tentando excluir
  via SQL direto (bypassando a UI) um contato com conversa — rejeitado
  pelo banco — e confirmando que a exclusão sem histórico e o
  arquivamento (`update`, não afetado pelo trigger) continuam
  funcionando normalmente.
- **`/contatos` como fonte única:** a aba "Contatos" do detalhe do
  cliente (`clientes/$clienteId.tsx`) virou somente leitura (grid de
  cards com nome/papel/WhatsApp/badge multi-CNPJ) mais um botão
  "Gerenciar contatos deste cliente" que leva para
  `/contatos?clientId=<id>` — toda criação/edição/vínculo/arquivamento
  agora vive só em `/contatos`, sem lógica duplicada entre as duas
  telas.
- **Filtro por cliente via URL:** `/contatos` aceita `clientId` via
  `validateSearch` do TanStack Router; quando presente, pré-filtra a
  lista e mostra um breadcrumb "Voltar para [Nome do Cliente]".
- **Mantido do recorte anterior:** `contacts.email` (opcional, só
  exibição/contato alternativo — o WhatsApp continua sendo o canal
  exigido e o único que a IA usa), decisão de não adicionar Nome
  Fantasia, consentimento LGPD somente leitura (calculado contra
  `consent_policy_versions`/`consent_log`, nunca editável manualmente —
  a constraint `consent_log.channel = 'whatsapp'` já impede fabricar
  consentimento por outro canal). RLS: reaproveita
  `contacts_all_same_tenant`/`client_contact_links_*_same_tenant`, sem
  policy nova.

## Gaps conhecidos / fora de escopo deste pacote

- **CSAT (Relatórios)** — não existe nenhuma coleta de satisfação no
  schema ainda. A pesquisa pós-atendimento via WhatsApp é descrita no PRD
  como um agente proativo de uma fase futura ("check-in de satisfação",
  seção 11/12). A tela mostra isso honestamente como "ainda não coletamos
  CSAT", em vez de um número fabricado.
- **Base de conhecimento** — o RAG semântico cobre só arquivos PDF; outros
  tipos de arquivo ficam marcados como `nao_suportado`. Sem fila de
  processamento: a ingestão roda de forma síncrona dentro da server
  function do upload.
- **Canal de e-mail (RF12)**, **Open Finance** e **agentes proativos**
  (check-in de satisfação, sugestão de melhorias) — descritos no PRD como
  Fase 3, não iniciados.

## Migrations relevantes (ordem cronológica)

```
20260901190000_structural_multi_tenant_core.sql
20260901193000_staff_self_update_and_invite_accept.sql
20260901194500_client_documents_and_contacts.sql
20260901200000_agenda_and_leads.sql
20260901210000_tenant_integrations.sql
20260902120000_configuracoes_extra.sql
20260902140000_conversations_and_orchestration.sql
20260902160000_whatsapp_webhook_support.sql
20260902170000_switch_ai_provider_to_openai.sql
20260902180000_business_hours.sql
20260902200000_escalation_overflow_job.sql
20260902220000_knowledge_base_rag.sql
20260902230000_knowledge_base_semantic_search.sql
20260902240000_document_submissions_due_date_snapshot.sql
20260902250000_report_metrics.sql
20260902260000_appointment_reminders.sql
20260903190000_contacts_email_and_archiving.sql
20260903200000_contacts_block_delete_with_history.sql
```
