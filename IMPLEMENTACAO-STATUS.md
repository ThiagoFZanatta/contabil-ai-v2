# Status de implementação

> Documento gerado para dar visibilidade do que já foi construído no repositório,
> a partir do PRD (**referência vigente: v1.6** — não alterado por este
> arquivo nem pelo trabalho descrito aqui). Reflete o estado da branch
> `claude/criar-telas-prd-78u21w` até o PR #12 (`2647952`, já mergeado),
> mais o PR #13 (lembrete automático de compromisso, RF06 — em revisão).

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
| #13 *(em revisão)* | Lembrete automático de compromisso via WhatsApp (RF06) |

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

## Lembrete automático de compromisso (RF06) — PR #13, em revisão

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

## Expiração de link de convite/recuperação de senha (RF01)

> A outra pendência que a v1.6 do PRD reclassificou como bloqueio de Fase 1.

Revisão de código confirma que já está coberta: `nova-senha.tsx` tem um
estado dedicado de "Link expirado" (se a sessão não se estabelece a partir
do token da URL em alguns segundos, mostra a tela de link expirado com
CTA para solicitar um novo), e `esqueci-senha.tsx` já evita enumeração de
e-mail e informa "o link expira em 24 horas". **Pendência operacional
(fora do código):** o TTL real do link é uma configuração do projeto
Supabase Auth (painel), não algo que uma migration ou consulta SQL
confirme — vale conferir em Authentication → Email se está de fato em 24h.

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
```
