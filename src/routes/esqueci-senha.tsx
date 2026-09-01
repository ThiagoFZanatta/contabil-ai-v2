import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/common/floating-input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Supabase não revela se o e-mail existe ou não na base (RF01) — o
    // resultado exibido ao usuário é sempre o mesmo, independente do erro.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao login
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
                <MailCheck className="size-6" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Verifique seu e-mail</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Se <span className="font-medium text-foreground">{email}</span> estiver cadastrado
                em nosso sistema, você receberá um link para redefinir sua senha em instantes. O
                link expira em 24 horas.
              </p>
              <Button variant="outline" className="mt-6 w-full" asChild>
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Esqueceu sua senha?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe o e-mail cadastrado e enviaremos um link para você redefinir sua senha.
                </p>
              </div>

              <FloatingInput
                label="E-mail cadastrado"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Enviando…
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
