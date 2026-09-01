import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/common/floating-input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nova-senha")({
  validateSearch: (search: Record<string, unknown>) => ({
    expired: search["expired"] === "1" || search["expired"] === 1 || search["expired"] === true,
  }),
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

function NovaSenhaPage() {
  const { expired } = Route.useSearch();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const s = useMemo(() => strength(senha), [senha]);
  const isValid = criteria.every((c) => c.test(senha)) && senha === confirmar && senha.length > 0;

  if (expired) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      navigate({ to: "/login" });
    }, 900);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Defina sua senha de acesso</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Crie uma senha forte para proteger o acesso aos dados dos seus clientes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
