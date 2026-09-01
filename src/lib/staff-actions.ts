import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteInput = z.object({
  email: z.string().trim().email(),
  departmentIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um departamento."),
});

/**
 * Convida um novo membro para a equipe (RF01). Só administradores do
 * próprio tenant podem convidar. Usa o service role (via supabaseAdmin,
 * carregado dinamicamente para nunca entrar no bundle do cliente) porque
 * `auth.admin.inviteUserByEmail` exige privilégio elevado.
 */
export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: caller, error: callerError } = await supabase
      .from("staff")
      .select("tenant_id, is_admin")
      .eq("id", userId)
      .single();

    if (callerError || !caller) {
      throw new Error("Não foi possível confirmar seu cadastro de equipe.");
    }
    if (!caller.is_admin) {
      throw new Error("Apenas administradores podem convidar novos membros.");
    }

    const { data: departments, error: departmentsError } = await supabase
      .from("departments")
      .select("id")
      .eq("tenant_id", caller.tenant_id)
      .in("id", data.departmentIds);

    if (departmentsError || !departments || departments.length !== data.departmentIds.length) {
      throw new Error("Um ou mais departamentos selecionados são inválidos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : undefined;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { tenant_id: caller.tenant_id },
        ...(origin ? { redirectTo: `${origin}/nova-senha` } : {}),
      },
    );

    if (inviteError || !invited.user) {
      throw new Error(inviteError?.message ?? "Não foi possível enviar o convite.");
    }

    const { error: staffError } = await supabaseAdmin.from("staff").insert({
      id: invited.user.id,
      tenant_id: caller.tenant_id,
      name: data.email.split("@")[0] ?? data.email,
      email: data.email,
      status: "convite_pendente",
    });

    if (staffError) {
      throw new Error(
        `Convite enviado, mas houve um erro ao registrar a equipe: ${staffError.message}`,
      );
    }

    const { error: linkError } = await supabaseAdmin
      .from("staff_departments")
      .insert(
        data.departmentIds.map((department_id) => ({ staff_id: invited.user.id, department_id })),
      );

    if (linkError) {
      throw new Error(
        `Convite enviado, mas houve um erro ao vincular departamentos: ${linkError.message}`,
      );
    }

    return { ok: true as const, email: data.email };
  });
