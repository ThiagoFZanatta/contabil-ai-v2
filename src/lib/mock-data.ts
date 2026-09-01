// Dados fictícios (mock) usados para dar vida às telas do painel enquanto o
// schema real do Supabase (seção 9 do PRD) ainda não está conectado.
// Nada aqui é persistido — cada rota mantém seu próprio estado local em memória.

export type DepartmentSlug = "fiscal" | "societario" | "financeiro" | "dp_rh" | "sdr";

export interface Department {
  slug: DepartmentSlug;
  nome: string;
}

export const departments: Department[] = [
  { slug: "fiscal", nome: "Fiscal/Contábil" },
  { slug: "societario", nome: "Societário" },
  { slug: "financeiro", nome: "Financeiro" },
  { slug: "dp_rh", nome: "DP/RH" },
  { slug: "sdr", nome: "SDR/Closer" },
];

export function departmentLabel(slug: DepartmentSlug) {
  return departments.find((d) => d.slug === slug)?.nome ?? slug;
}

export interface StaffMember {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
  departamentos: DepartmentSlug[];
  status: "ativo" | "convite_pendente";
  admin?: boolean;
}

export const currentStaff: StaffMember = {
  id: "staff-1",
  nome: "Thiago Zanatta",
  email: "thiago@zanattaemota.com.br",
  iniciais: "TZ",
  departamentos: ["fiscal", "societario", "financeiro", "dp_rh", "sdr"],
  status: "ativo",
  admin: true,
};

export const staffMembers: StaffMember[] = [
  currentStaff,
  {
    id: "staff-2",
    nome: "Camila Duarte",
    email: "camila.duarte@zanattaemota.com.br",
    iniciais: "CD",
    departamentos: ["fiscal"],
    status: "ativo",
  },
  {
    id: "staff-3",
    nome: "Rafael Nogueira",
    email: "rafael.nogueira@zanattaemota.com.br",
    iniciais: "RN",
    departamentos: ["financeiro"],
    status: "ativo",
  },
  {
    id: "staff-4",
    nome: "Bianca Ferraz",
    email: "bianca.ferraz@zanattaemota.com.br",
    iniciais: "BF",
    departamentos: ["dp_rh"],
    status: "ativo",
  },
  {
    id: "staff-5",
    nome: "Diego Salgado",
    email: "diego.salgado@zanattaemota.com.br",
    iniciais: "DS",
    departamentos: ["sdr"],
    status: "convite_pendente",
  },
  {
    id: "staff-6",
    nome: "Larissa Prado",
    email: "larissa.prado@zanattaemota.com.br",
    iniciais: "LP",
    departamentos: ["societario", "fiscal"],
    status: "convite_pendente",
  },
];

export type DocStatus = "em_dia" | "pendente" | "atrasado";

export interface ClientDocument {
  id: string;
  nome: string;
  periodicidade: "mensal" | "trimestral" | "anual" | "sob_demanda";
  prazo: string; // dd/mm
  status: DocStatus;
  dataRecebimento: string | null;
}

export interface ClientContact {
  id: string;
  nome: string;
  whatsapp: string;
  papel: string;
  outrosClientes: string[]; // nomes de outras empresas que este contato também atende
}

export interface Client {
  id: string;
  nome: string;
  cnpj: string;
  regimeTributario: "Simples Nacional" | "Lucro Presumido" | "Lucro Real";
  whatsapp: string;
  status: DocStatus;
  responsavelInterno: string;
  ultimaInteracao: string;
  documentos: ClientDocument[];
  contatos: ClientContact[];
  contexto: string;
}

const primeirosNomes = [
  "Padaria Trigo Dourado",
  "Auto Peças Rota 12",
  "Studio Beleza Nativa",
  "Mercadinho Bom Preço",
  "Construtora Alicerce",
  "Pet Shop Amigo Fiel",
  "Ótica Visão Clara",
  "Restaurante Sabor Caseiro",
  "Distribuidora Vale Sul",
  "Farmácia Vida Plena",
  "Papelaria Criativa",
  "Academia Corpo em Forma",
  "Clínica Odonto Sorriso",
  "Loja Moda Urbana",
  "Transportadora Rota Fácil",
  "Serralheria Ferro Forte",
  "Floricultura Jardim Feliz",
  "Escola de Idiomas Fala Bem",
  "Imobiliária Novo Lar",
  "Gráfica Impressão Rápida",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export const clients: Client[] = primeirosNomes.map((nome, i) => {
  const statusCycle: DocStatus[] = ["em_dia", "pendente", "atrasado"];
  const status = statusCycle[i % 3]!;
  const responsaveis = ["Camila Duarte", "Rafael Nogueira", "Thiago Zanatta"];
  return {
    id: `client-${i + 1}`,
    nome,
    cnpj: `${10 + i}.${345 + i}.${678 + i}/0001-${pad((i * 7) % 99)}`,
    regimeTributario: i % 5 === 0 ? "Lucro Presumido" : "Simples Nacional",
    whatsapp: `+55 11 9${pad(8000 + i)}-${pad(1000 + i * 3)}`,
    status,
    responsavelInterno: responsaveis[i % responsaveis.length]!,
    ultimaInteracao: `${pad((i % 27) + 1)}/08/2026`,
    documentos: [
      {
        id: `${i}-nf`,
        nome: "Notas fiscais de saída",
        periodicidade: "mensal",
        prazo: "05/09",
        status: statusCycle[(i + 1) % 3]!,
        dataRecebimento: statusCycle[(i + 1) % 3] === "em_dia" ? "03/08/2026" : null,
      },
      {
        id: `${i}-extrato`,
        nome: "Extrato bancário",
        periodicidade: "mensal",
        prazo: "10/09",
        status: statusCycle[(i + 2) % 3]!,
        dataRecebimento: statusCycle[(i + 2) % 3] === "em_dia" ? "08/08/2026" : null,
      },
      {
        id: `${i}-folha`,
        nome: "Folha de ponto",
        periodicidade: "mensal",
        prazo: "07/09",
        status: "em_dia",
        dataRecebimento: "05/08/2026",
      },
      {
        id: `${i}-contrato`,
        nome: "Contrato social atualizado",
        periodicidade: "sob_demanda",
        prazo: "—",
        status: "em_dia",
        dataRecebimento: "12/01/2026",
      },
    ],
    contatos: [
      {
        id: `${i}-c1`,
        nome: nome.split(" ").slice(-1)[0] + " Sócio",
        whatsapp: `+55 11 9${pad(8000 + i)}-${pad(1000 + i * 3)}`,
        papel: "Dono(a)",
        outrosClientes: i % 6 === 0 ? [primeirosNomes[(i + 3) % primeirosNomes.length]!] : [],
      },
      ...(i % 4 === 0
        ? [
            {
              id: `${i}-c2`,
              nome: "Assistente Financeiro",
              whatsapp: `+55 11 9${pad(7000 + i)}-${pad(2000 + i * 2)}`,
              papel: "Financeiro",
              outrosClientes: [],
            },
          ]
        : []),
    ],
    contexto:
      "Cliente prioriza contato por voz para dúvidas mais longas. Regime tributário revisado em janeiro/2026. Sócio costuma viajar na primeira semana do mês.",
  };
});

export type ConversationSender = "ia" | "humano" | "cliente";

export interface ConversationMessage {
  id: string;
  remetente: ConversationSender;
  texto: string;
  hora: string;
}

export interface Conversation {
  id: string;
  nomeContato: string;
  empresa: string | null;
  tipo: "cliente" | "lead";
  departamento: DepartmentSlug;
  ultimaMensagem: string;
  esperaMin: number;
  overflow: boolean;
  emAtendimentoPor: string | null;
  mensagens: ConversationMessage[];
}

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    nomeContato: "Juliana Prado",
    empresa: "Padaria Trigo Dourado",
    tipo: "cliente",
    departamento: "fiscal",
    ultimaMensagem: "Ainda não recebi a guia do DAS deste mês, alguém pode confirmar?",
    esperaMin: 6,
    overflow: false,
    emAtendimentoPor: null,
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto: "Oi, bom dia! Vocês já geraram a guia do Simples desse mês?",
        hora: "09:12",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "Bom dia, Juliana! Deixa eu verificar aqui o status da apuração da Padaria Trigo Dourado.",
        hora: "09:12",
      },
      {
        id: "m3",
        remetente: "ia",
        texto:
          "Encontrei uma pendência: o extrato bancário de agosto ainda não foi enviado, e isso pode atrasar o cálculo. Consigo te ajudar a resolver, ou prefere falar com o time Fiscal?",
        hora: "09:13",
      },
      {
        id: "m4",
        remetente: "cliente",
        texto: "Ainda não recebi a guia do DAS deste mês, alguém pode confirmar?",
        hora: "09:14",
      },
    ],
  },
  {
    id: "conv-2",
    nomeContato: "Marcos Vinícius",
    empresa: "Auto Peças Rota 12",
    tipo: "cliente",
    departamento: "financeiro",
    ultimaMensagem: "Consigo parcelar essa diferença de honorários?",
    esperaMin: 22,
    overflow: true,
    emAtendimentoPor: null,
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto: "Recebi a cobrança dos honorários com valor diferente do combinado.",
        hora: "08:40",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "Entendo a preocupação, Marcos. Isso envolve uma negociação de valores, então vou te conectar com o time Financeiro para revisar com você.",
        hora: "08:41",
      },
      {
        id: "m3",
        remetente: "cliente",
        texto: "Consigo parcelar essa diferença de honorários?",
        hora: "08:58",
      },
    ],
  },
  {
    id: "conv-3",
    nomeContato: "Fernanda Ribas",
    empresa: "Studio Beleza Nativa",
    tipo: "cliente",
    departamento: "dp_rh",
    ultimaMensagem: "Preciso admitir uma funcionária nova, como funciona?",
    esperaMin: 3,
    overflow: false,
    emAtendimentoPor: null,
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto: "Preciso admitir uma funcionária nova, como funciona?",
        hora: "10:02",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "Ótimo! Para admissões preciso confirmar alguns detalhes com o time de DP. Já te encaminho.",
        hora: "10:03",
      },
    ],
  },
  {
    id: "conv-4",
    nomeContato: "Roberto Salles",
    empresa: null,
    tipo: "lead",
    departamento: "sdr",
    ultimaMensagem: "Quero saber mais sobre planos para comércio.",
    esperaMin: 14,
    overflow: false,
    emAtendimentoPor: null,
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto:
          "Oi, vi o anúncio de vocês. Trabalho com uma loja de roupas e quero trocar de contador.",
        hora: "11:20",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "Que bom te ter por aqui, Roberto! Me conta rapidamente: hoje sua empresa é do Simples Nacional?",
        hora: "11:20",
      },
      { id: "m3", remetente: "cliente", texto: "Sim, é do Simples.", hora: "11:24" },
      {
        id: "m4",
        remetente: "ia",
        texto:
          "Perfeito. Vou te conectar com nosso time comercial para marcarmos uma conversa rápida.",
        hora: "11:24",
      },
      {
        id: "m5",
        remetente: "cliente",
        texto: "Quero saber mais sobre planos para comércio.",
        hora: "11:25",
      },
    ],
  },
  {
    id: "conv-5",
    nomeContato: "Patrícia Nunes",
    empresa: "Ótica Visão Clara",
    tipo: "cliente",
    departamento: "societario",
    ultimaMensagem: "Vou precisar alterar o quadro societário ainda esse mês.",
    esperaMin: 41,
    overflow: true,
    emAtendimentoPor: "Larissa Prado",
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto: "Vou precisar alterar o quadro societário ainda esse mês.",
        hora: "07:55",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "Entendi, Patrícia. Alteração de quadro societário é um processo mais formal — vou escalar para o time responsável cuidar com você.",
        hora: "07:56",
      },
      {
        id: "m3",
        remetente: "humano",
        texto:
          "Oi Patrícia, aqui é a Larissa do Societário! Já estou olhando seu contrato social, te retorno em instantes.",
        hora: "08:30",
      },
    ],
  },
  {
    id: "conv-6",
    nomeContato: "Eduardo Lima",
    empresa: "Mercadinho Bom Preço",
    tipo: "cliente",
    departamento: "fiscal",
    ultimaMensagem: "Show, muito obrigado pela ajuda!",
    esperaMin: 1,
    overflow: false,
    emAtendimentoPor: null,
    mensagens: [
      {
        id: "m1",
        remetente: "cliente",
        texto: "Qual o prazo pra mandar as notas de agosto?",
        hora: "13:05",
      },
      {
        id: "m2",
        remetente: "ia",
        texto:
          "O prazo para as notas fiscais de saída de agosto é dia 05/09. Você já enviou 18 das suas notas, faltam só as da última semana.",
        hora: "13:05",
      },
      { id: "m3", remetente: "cliente", texto: "Show, muito obrigado pela ajuda!", hora: "13:06" },
    ],
  },
];

export interface Appointment {
  id: string;
  titulo: string;
  cliente: string;
  tipo: "ligacao" | "video" | "presencial";
  staffId: string;
  data: string; // yyyy-mm-dd
  horaInicio: string;
  duracaoMin: number;
  origem: "ia" | "manual";
}

export const appointments: Appointment[] = [
  {
    id: "ag-1",
    titulo: "Dúvida sobre parcelamento",
    cliente: "Auto Peças Rota 12",
    tipo: "ligacao",
    staffId: "staff-3",
    data: "2026-09-01",
    horaInicio: "10:00",
    duracaoMin: 30,
    origem: "ia",
  },
  {
    id: "ag-2",
    titulo: "Revisão de contrato social",
    cliente: "Ótica Visão Clara",
    tipo: "video",
    staffId: "staff-6",
    data: "2026-09-01",
    horaInicio: "14:00",
    duracaoMin: 45,
    origem: "manual",
  },
  {
    id: "ag-3",
    titulo: "Onboarding novo cliente",
    cliente: "Papelaria Criativa",
    tipo: "presencial",
    staffId: "staff-1",
    data: "2026-09-02",
    horaInicio: "09:30",
    duracaoMin: 60,
    origem: "manual",
  },
  {
    id: "ag-4",
    titulo: "Reunião de qualificação",
    cliente: "Roberto Salles (lead)",
    tipo: "video",
    staffId: "staff-5",
    data: "2026-09-02",
    horaInicio: "16:00",
    duracaoMin: 30,
    origem: "ia",
  },
  {
    id: "ag-5",
    titulo: "Admissão de funcionária",
    cliente: "Studio Beleza Nativa",
    tipo: "ligacao",
    staffId: "staff-4",
    data: "2026-09-03",
    horaInicio: "11:00",
    duracaoMin: 20,
    origem: "ia",
  },
  {
    id: "ag-6",
    titulo: "Fechamento de folha",
    cliente: "Construtora Alicerce",
    tipo: "presencial",
    staffId: "staff-4",
    data: "2026-09-04",
    horaInicio: "09:00",
    duracaoMin: 90,
    origem: "manual",
  },
];

export interface Lead {
  id: string;
  nome: string;
  segmento: string;
  motivo: string;
  data: string;
  coluna: "novo" | "qualificado" | "call_agendada" | "convertido" | "perdido";
  tentouAgendarIA: boolean;
}

export const leadsSeed: Lead[] = [
  {
    id: "lead-1",
    nome: "Vinícius Almeida",
    segmento: "Comércio — Vestuário",
    motivo: "Trocar de contador",
    data: "30/08",
    coluna: "novo",
    tentouAgendarIA: false,
  },
  {
    id: "lead-2",
    nome: "Renata Cardoso",
    segmento: "Serviços — Estética",
    motivo: "Abrir empresa (MEI → ME)",
    data: "29/08",
    coluna: "novo",
    tentouAgendarIA: false,
  },
  {
    id: "lead-3",
    nome: "Roberto Salles",
    segmento: "Comércio — Vestuário",
    motivo: "Cotação de plano contábil",
    data: "28/08",
    coluna: "qualificado",
    tentouAgendarIA: true,
  },
  {
    id: "lead-4",
    nome: "Ana Beatriz Costa",
    segmento: "Comércio — Alimentos",
    motivo: "Insatisfeita com contador atual",
    data: "27/08",
    coluna: "qualificado",
    tentouAgendarIA: true,
  },
  {
    id: "lead-5",
    nome: "Gustavo Peixoto",
    segmento: "Serviços — Oficina",
    motivo: "Regularização de débitos",
    data: "25/08",
    coluna: "call_agendada",
    tentouAgendarIA: true,
  },
  {
    id: "lead-6",
    nome: "Camila Torres",
    segmento: "Comércio — Papelaria",
    motivo: "Abertura de filial",
    data: "22/08",
    coluna: "call_agendada",
    tentouAgendarIA: true,
  },
  {
    id: "lead-7",
    nome: "Felipe Aragão",
    segmento: "Comércio — Pet shop",
    motivo: "Trocar de contador",
    data: "18/08",
    coluna: "convertido",
    tentouAgendarIA: true,
  },
  {
    id: "lead-8",
    nome: "Sônia Matos",
    segmento: "Serviços — Salão de beleza",
    motivo: "Cotação de plano contábil",
    data: "14/08",
    coluna: "perdido",
    tentouAgendarIA: true,
  },
];

export interface FaqItem {
  id: string;
  pergunta: string;
  resposta: string;
}

export const faqs: FaqItem[] = [
  {
    id: "faq-1",
    pergunta: "Qual o prazo padrão para pagamento do DAS do Simples Nacional?",
    resposta:
      "O DAS vence todo dia 20 do mês seguinte ao período de apuração. Se cair em dia não útil, o vencimento é antecipado para o dia útil anterior.",
  },
  {
    id: "faq-2",
    pergunta: "Como envio uma nota fiscal pelo WhatsApp?",
    resposta:
      "Basta enviar o PDF ou a foto da nota diretamente na conversa. A IA confirma o recebimento e vincula ao seu cadastro automaticamente.",
  },
  {
    id: "faq-3",
    pergunta: "Posso trocar o regime tributário da minha empresa?",
    resposta:
      "Sim, mas a mudança de regime só pode ser solicitada em janeiro (início do ano-calendário), exceto em casos específicos de enquadramento. Fale com o time Fiscal para avaliar o seu caso.",
  },
  {
    id: "faq-4",
    pergunta: "Quais documentos preciso enviar todo mês?",
    resposta:
      "Depende da configuração de cada cliente, mas geralmente: notas fiscais de saída, extrato bancário e folha de ponto (se houver funcionários).",
  },
];

export interface KbDocument {
  id: string;
  nome: string;
  tipo: "PDF" | "DOCX";
  tamanhoKb: number;
  dataUpload: string;
}

export const kbDocuments: KbDocument[] = [
  {
    id: "kb-1",
    nome: "Manual interno — Simples Nacional 2026.pdf",
    tipo: "PDF",
    tamanhoKb: 842,
    dataUpload: "12/02/2026",
  },
  {
    id: "kb-2",
    nome: "Guia de obrigações acessórias — Comércio.pdf",
    tipo: "PDF",
    tamanhoKb: 1180,
    dataUpload: "03/03/2026",
  },
  {
    id: "kb-3",
    nome: "Política de atendimento e SLA.docx",
    tipo: "DOCX",
    tamanhoKb: 96,
    dataUpload: "20/05/2026",
  },
];

export type TemplateStatus = "aprovado" | "pendente" | "rejeitado";

export interface MessageTemplate {
  id: string;
  nome: string;
  categoria: "Utilidade" | "Marketing" | "Autenticação";
  status: TemplateStatus;
  corpo: string;
}

export const messageTemplates: MessageTemplate[] = [
  {
    id: "tpl-1",
    nome: "cobranca_documento_mensal",
    categoria: "Utilidade",
    status: "aprovado",
    corpo: "Olá {{1}}! Está chegando o prazo de envio do(a) {{2}}. Pode nos enviar por aqui mesmo?",
  },
  {
    id: "tpl-2",
    nome: "lembrete_reforco_documento",
    categoria: "Utilidade",
    status: "aprovado",
    corpo:
      "Oi {{1}}, ainda não recebemos o(a) {{2}}. Consegue nos enviar hoje para não atrasar a apuração?",
  },
  {
    id: "tpl-3",
    nome: "lembrete_compromisso",
    categoria: "Utilidade",
    status: "aprovado",
    corpo: "Lembrete: você tem {{1}} agendado(a) para {{2}} às {{3}}.",
  },
  {
    id: "tpl-4",
    nome: "aviso_migracao_canal_ia",
    categoria: "Utilidade",
    status: "pendente",
    corpo:
      "Olá! Nosso atendimento mudou de número e agora conta com apoio de inteligência artificial. Podemos seguir por aqui?",
  },
  {
    id: "tpl-5",
    nome: "pesquisa_satisfacao",
    categoria: "Marketing",
    status: "rejeitado",
    corpo: "Como foi seu atendimento hoje? Responda de 1 a 5.",
  },
];

export interface ConsentVersion {
  versao: string;
  texto: string;
  dataPublicacao: string;
}

export const consentVersions: ConsentVersion[] = [
  {
    versao: "v1.2",
    dataPublicacao: "15/07/2026",
    texto:
      "Olá! Este atendimento é feito com apoio de inteligência artificial. Para te ajudar, podemos processar as informações que você compartilhar aqui (dúvidas, documentos enviados, dados da sua empresa) e, quando necessário, encaminhar sua conversa para um de nossos especialistas humanos. Você pode falar com uma pessoa da nossa equipe a qualquer momento — é só pedir. Nossa política de privacidade está em: [link]. Podemos seguir?",
  },
  {
    versao: "v1.1",
    dataPublicacao: "02/03/2026",
    texto:
      "Olá! Este atendimento pode ser feito com apoio de inteligência artificial e seus dados podem ser usados para dar continuidade ao atendimento. Podemos seguir?",
  },
  {
    versao: "v1.0",
    dataPublicacao: "10/01/2026",
    texto: "Olá! Podemos usar suas informações para te atender por aqui?",
  },
];

export interface DocumentCatalogItem {
  id: string;
  nome: string;
  periodicidadePadrao: "mensal" | "trimestral" | "anual" | "sob_demanda";
}

export const documentCatalog: DocumentCatalogItem[] = [
  { id: "cat-1", nome: "Notas fiscais de saída", periodicidadePadrao: "mensal" },
  { id: "cat-2", nome: "Notas fiscais de entrada", periodicidadePadrao: "mensal" },
  { id: "cat-3", nome: "Extrato bancário", periodicidadePadrao: "mensal" },
  { id: "cat-4", nome: "Folha de ponto", periodicidadePadrao: "mensal" },
  { id: "cat-5", nome: "Contrato social atualizado", periodicidadePadrao: "sob_demanda" },
  { id: "cat-6", nome: "Balanço patrimonial", periodicidadePadrao: "anual" },
  { id: "cat-7", nome: "Guia de FGTS", periodicidadePadrao: "mensal" },
  {
    id: "cat-8",
    nome: "Relação de funcionários admitidos/demitidos",
    periodicidadePadrao: "trimestral",
  },
];

export interface CopilotInteraction {
  id: string;
  conversaId: string;
  tipo: "resumir" | "sugerir_resposta";
  resultado: string;
  status: "aceita" | "editada" | "descartada" | null;
}

export function statusLabel(status: DocStatus) {
  return { em_dia: "Em dia", pendente: "Pendente", atrasado: "Atrasado" }[status];
}

export function docStatusFromClient(client: Client): DocStatus {
  if (client.documentos.some((d) => d.status === "atrasado")) return "atrasado";
  if (client.documentos.some((d) => d.status === "pendente")) return "pendente";
  return "em_dia";
}
