import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FloatingInput } from "@/components/common/floating-input";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import { departments, staffMembers, type DepartmentSlug, type StaffMember } from "@/lib/mock-data";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
});

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function EquipePage() {
  const [members, setMembers] = useState<StaffMember[]>(staffMembers);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<DepartmentSlug[]>([]);
  const [confirmation, setConfirmation] = useState(false);

  const emailError = email && !isValidEmail(email) ? "Informe um e-mail válido." : undefined;
  const canInvite = isValidEmail(email) && selectedDeps.length > 0;

  function toggleDep(slug: DepartmentSlug) {
    setSelectedDeps((prev) =>
      prev.includes(slug) ? prev.filter((d) => d !== slug) : [...prev, slug],
    );
  }

  function sendInvite() {
    if (!canInvite) return;
    setMembers((prev) => [
      {
        id: `staff-${prev.length + 1}`,
        nome: (email.split("@")[0] ?? email).replace(/[._]/g, " "),
        email,
        iniciais: email.slice(0, 2).toUpperCase(),
        departamentos: selectedDeps,
        status: "convite_pendente",
      },
      ...prev,
    ]);
    setOpen(false);
    setEmail("");
    setSelectedDeps([]);
    setConfirmation(true);
    window.setTimeout(() => setConfirmation(false), 3500);
  }

  return (
    <AppShell title="Gestão de equipe" description="Quem tem acesso ao painel e a quais áreas.">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Membros da equipe</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} pessoa{members.length !== 1 && "s"} com acesso ao painel.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus /> Convidar pessoa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar novo membro</DialogTitle>
              <DialogDescription>
                Enviaremos um e-mail com um link para essa pessoa definir a própria senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <FloatingInput
                label="E-mail da pessoa"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={emailError}
              />
              <div>
                <Label className="mb-2 block text-sm">Departamentos</Label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => {
                    const active = selectedDeps.includes(d.slug);
                    return (
                      <button
                        type="button"
                        key={d.slug}
                        onClick={() => toggleDep(d.slug)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        {d.nome}
                      </button>
                    );
                  })}
                </div>
                {selectedDeps.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Selecione ao menos um departamento.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!canInvite} onClick={sendInvite}>
                Enviar convite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {confirmation && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          Convite enviado com sucesso!
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro além de você ainda"
          description="Convide pessoas da sua equipe para começar a atender pelo painel."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Departamentos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {m.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{m.nome}</span>
                      {m.admin && (
                        <Badge variant="outline" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.departamentos.map((d) => (
                        <Badge key={d} variant="secondary" className="font-normal">
                          {departments.find((dep) => dep.slug === d)?.nome}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.status === "ativo" ? (
                      <Badge className="bg-success/15 text-success border-success/30 border">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/20 text-warning-foreground border-warning/40 border">
                        Convite pendente
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
