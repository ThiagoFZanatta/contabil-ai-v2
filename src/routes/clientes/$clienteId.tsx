import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Link2, Search, UserPlus, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { CopilotWidget } from "@/components/common/copilot-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { clients, docStatusFromClient } from "@/lib/mock-data";

export const Route = createFileRoute("/clientes/$clienteId")({
  component: ClienteDetalhePage,
});

function ClienteDetalhePage() {
  const { clienteId } = Route.useParams();
  const client = clients.find((c) => c.id === clienteId) ?? clients[0]!;

  const [docsEnabled, setDocsEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(client.documentos.map((d) => [d.id, true])),
  );
  const [contexto, setContexto] = useState(client.contexto);
  const [linkOpen, setLinkOpen] = useState(false);
  const [searchContato, setSearchContato] = useState("");

  function salvar(secao: string) {
    toast.success(`${secao} salvo com sucesso.`);
  }

  return (
    <AppShell title={client.nome} description={client.cnpj}>
      <Link
        to="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="size-12">
          <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
            {client.nome.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{client.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {client.cnpj} · {client.regimeTributario} · {client.whatsapp}
          </p>
        </div>
        <StatusBadge status={docStatusFromClient(client)} />
      </div>

      <Tabs defaultValue="documentos">
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="contexto">Contexto/Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {client.documentos.map((doc) => (
                <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:flex-1">
                    <Checkbox
                      id={doc.id}
                      checked={docsEnabled[doc.id] ?? true}
                      onCheckedChange={(v) =>
                        setDocsEnabled((prev) => ({ ...prev, [doc.id]: v === true }))
                      }
                    />
                    <Label htmlFor={doc.id} className="cursor-pointer font-medium text-foreground">
                      {doc.nome}
                    </Label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:w-auto">
                    <Select defaultValue={doc.periodicidade}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                        <SelectItem value="sob_demanda">Sob demanda</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      defaultValue={doc.prazo}
                      className="h-8 w-24 text-xs"
                      aria-label="Prazo"
                    />
                    <StatusBadge status={doc.status} />
                    {doc.dataRecebimento && (
                      <span className="text-xs text-muted-foreground">
                        recebido em {doc.dataRecebimento}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => salvar("Documentos")}>Salvar documentos</Button>
          </div>
        </TabsContent>

        <TabsContent value="contatos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Link2 /> Vincular contato existente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular contato existente</DialogTitle>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou WhatsApp…"
                    value={searchContato}
                    onChange={(e) => setSearchContato(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Um contato pode falar em nome de mais de um CNPJ. Todos os contatos vinculados têm
                  as mesmas permissões.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLinkOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      setLinkOpen(false);
                      toast.success("Contato vinculado a este cliente.");
                    }}
                  >
                    Vincular
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button className="ml-2">
              <UserPlus /> Novo contato
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {client.contatos.map((contato) => (
                <li key={contato.id} className="flex flex-wrap items-center gap-3 p-4">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-secondary text-xs font-semibold">
                      {contato.nome.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{contato.nome}</p>
                    <p className="text-xs text-muted-foreground">{contato.whatsapp}</p>
                  </div>
                  <Badge variant="secondary">{contato.papel}</Badge>
                  {contato.outrosClientes.map((nome) => (
                    <Badge key={nome} variant="outline" className="gap-1 text-xs">
                      <Building2 className="size-3" /> também atende: {nome}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="contexto" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label htmlFor="contexto" className="mb-2 block text-sm font-medium">
              Contexto e observações para a IA
            </Label>
            <Textarea
              id="contexto"
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              className="min-h-32"
            />
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <FileUp className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Arraste arquivos de contexto aqui</p>
            <p className="text-xs text-muted-foreground">
              ou clique para selecionar (PDF, DOCX, até 10MB)
            </p>
            <input type="file" className="mt-3 w-full cursor-pointer text-xs" multiple />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => salvar("Contexto")}>Salvar contexto</Button>
          </div>
        </TabsContent>
      </Tabs>

      <CopilotWidget context={`Cliente ${client.nome}, regime ${client.regimeTributario}.`} />
    </AppShell>
  );
}
