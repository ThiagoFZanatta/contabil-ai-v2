import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import { inviteStaffMember } from "@/lib/staff-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
});

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

interface Department {
  id: string;
  slug: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  status: string;
  isAdmin: boolean;
  departmentIds: string[];
}

function EquipePage() {
  const session = useCurrentStaff();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  async function loadTeam(tenantId: string) {
    const [{ data: deptRows, error: deptError }, { data: staffRows, error: staffError }] =
      await Promise.all([
        supabase
          .from("departments")
          .select("id, slug, name")
          .eq("tenant_id", tenantId)
          .order("name"),
        supabase.from("staff").select("id, name, email, status, is_admin").order("created_at"),
      ]);

    if (deptError || staffError) {
      setLoadError("Não foi possível carregar a equipe agora. Tente recarregar a página.");
      return;
    }

    const { data: links } = await supabase
      .from("staff_departments")
      .select("staff_id, department_id");

    setDepartments(deptRows ?? []);
    setMembers(
      (staffRows ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.status,
        isAdmin: s.is_admin,
        departmentIds: (links ?? []).filter((l) => l.staff_id === s.id).map((l) => l.department_id),
      })),
    );
  }

  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  useEffect(() => {
    if (tenantId) {
      loadTeam(tenantId);
    }
  }, [tenantId]);

  const emailError = email && !isValidEmail(email) ? "Informe um e-mail válido." : undefined;
  const canInvite = isValidEmail(email) && selectedDeps.length > 0;

  function toggleDep(id: string) {
    setSelectedDeps((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function sendInvite() {
    if (!canInvite || session.status !== "ready") return;
    setSending(true);
    setInviteError(null);
    try {
      await inviteStaffMember({ data: { email, departmentIds: selectedDeps } });
      setOpen(false);
      setEmail("");
      setSelectedDeps([]);
      setConfirmation(true);
      window.setTimeout(() => setConfirmation(false), 3500);
      await loadTeam(session.staff.tenantId);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Não foi possível enviar o convite.");
    } finally {
      setSending(false);
    }
  }

  if (session.status !== "ready") {
    return (
      <AppShell title="Gestão de equipe">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Gestão de equipe" description="Quem tem acesso ao painel e a quais áreas.">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Membros da equipe</h2>
          <p className="text-sm text-muted-foreground">
            {members
              ? `${members.length} pessoa${members.length !== 1 ? "s" : ""} com acesso ao painel.`
              : "Carregando…"}
          </p>
        </div>
        {session.staff.isAdmin && (
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
                {inviteError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}
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
                      const active = selectedDeps.includes(d.id);
                      return (
                        <button
                          type="button"
                          key={d.id}
                          onClick={() => toggleDep(d.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-foreground hover:bg-accent",
                          )}
                        >
                          {d.name}
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
                <Button disabled={!canInvite || sending} onClick={sendInvite}>
                  {sending ? "Enviando…" : "Enviar convite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {confirmation && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
          Convite enviado com sucesso!
        </div>
      )}

      {loadError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {members === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
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
                          {m.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{m.name}</span>
                      {m.isAdmin && (
                        <Badge variant="outline" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.departmentIds.map((id) => {
                        const dep = departments.find((d) => d.id === id);
                        return dep ? (
                          <Badge key={id} variant="secondary" className="font-normal">
                            {dep.name}
                          </Badge>
                        ) : null;
                      })}
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
