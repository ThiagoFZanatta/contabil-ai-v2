import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, Circle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/common/floating-input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
});

const criteria = [
  { id: "len", label: "Ao menos 8 caracteres", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "1 letra maiúscula", test: (v: string) => /[A-Z]/.test(v) },
  { id: "num", label: "1 número", test: (v: string) => /\d/.test(v) },
];

function strength(v: string) {
  const passed = criteria.filter((c) => c.test(v)).length;
  if (!v) return { label: "", pct: 0, tone: "" };
  if (passed <= 1) return { label: "Fraca", pct: 33, tone: "bg-destructive" };
  if (passed === 2) return { label: "Média", pct: 66, tone: "bg-warning" };
  return { label: "Forte", pct: 100, tone: "bg-success" };
}

type Mode =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "invite"; suggestedName: string }
  | { kind: "recovery" };

function NovaSenhaPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>({ kind: "checking" });
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const s = useMemo(() => strength(senha), [senha]);
  const isValid = criteria.every((c) => c.test(senha)) && senha === confirmar && senha.length > 0;

  useEffect(() => {
    let resolved = false;
    let cancelled = false;

    async function resolveFromSession(session: Session | null) {
      if (!session || resolved || cancelled) return;
      resolved = true;

      const { data: staffRow } = await supabase
        .from("staff")
        .select("status, name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (staffRow?.status === "convite_pendente") {
        setNome(staffRow.name ?? "");
        setMode({ kind: "invite", suggestedName: staffRow.name ?? "" });
      } else {
        setMode({ kind: "recovery" });
      }
    }

    supabase.auth.getSession().then(({ data }) => resolveFromSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveFromSession(session);
    });

    const timeout = window.setTimeout(() => {
      if (!resolved && !cancelled) setMode({ kind: "invalid" });
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || mode.kind === "checking" || mode.kind === "invalid") return;

    setLoading(true);
    setSubmitError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password: senha });
    if (updateError) {
      setSubmitError("Não foi possível salvar a senha. Tente novamente.");
      setLoading(false);
      return;
    }

    if (mode.kind === "invite") {
      const { error: acceptError } = await supabase.rpc("accept_staff_invite", {
        p_name: nome || mode.suggestedName,
      });
      if (acceptError) {
        setSubmitError(
          "Senha salva, mas houve um erro ao concluir seu cadastro. Fale com o administrador.",
        );
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate({ to: "/" });
  }

  if (mode.kind === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mode.kind === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Link expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não é mais válido. Solicite um novo link de acesso para continuar.
          </p>
          <Button className="mt-6 w-full" asChild>
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            {mode.kind === "invite"
              ? "Bem-vindo(a)! Defina sua senha de acesso"
              : "Defina sua senha de acesso"}
          </h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            {mode.kind === "invite"
              ? "Confirme seu nome e crie uma senha forte para acessar o painel."
              : "Crie uma senha forte para proteger o acesso aos dados dos seus clientes."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {mode.kind === "invite" && (
              <FloatingInput
                label="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            )}

            <div className="relative">
              <FloatingInput
                label="Nova senha"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {senha && (
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", s.tone)}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Força da senha: {s.label}</p>
              </div>
            )}

            <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3">
              {criteria.map((c) => {
                const ok = c.test(senha);
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      ok ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {ok ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                    {c.label}
                  </li>
                );
              })}
            </ul>

            <FloatingInput
              label="Confirmar senha"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              error={confirmar && senha !== confirmar ? "As senhas não coincidem." : undefined}
            />

            <Button type="submit" className="w-full" disabled={!isValid || loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> Salvando…
                </>
              ) : (
                "Confirmar senha"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
