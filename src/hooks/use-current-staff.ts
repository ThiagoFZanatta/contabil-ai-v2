import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export interface CurrentStaff {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  isAdmin: boolean;
  status: string;
  departmentSlugs: string[];
}

type CurrentStaffState =
  { status: "loading" } | { status: "unauthenticated" } | { status: "ready"; staff: CurrentStaff };

/**
 * Sessão + identidade real do staff logado. Redireciona para /login quando
 * não há sessão válida — funciona como o guard de rota das telas internas.
 */
export function useCurrentStaff(): CurrentStaffState {
  const navigate = useNavigate();
  const [state, setState] = useState<CurrentStaffState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (!cancelled) setState({ status: "unauthenticated" });
        return;
      }

      const { data: staffRow, error: staffError } = await supabase
        .from("staff")
        .select("id, tenant_id, name, email, is_admin, status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (staffError || !staffRow) {
        setState({ status: "unauthenticated" });
        return;
      }

      const { data: deptLinks } = await supabase
        .from("staff_departments")
        .select("department_id")
        .eq("staff_id", staffRow.id);

      let departmentSlugs: string[] = [];
      if (deptLinks && deptLinks.length > 0) {
        const { data: depts } = await supabase
          .from("departments")
          .select("slug")
          .in(
            "id",
            deptLinks.map((d) => d.department_id),
          );
        departmentSlugs = (depts ?? []).map((d) => d.slug);
      }

      if (cancelled) return;

      setState({
        status: "ready",
        staff: {
          id: staffRow.id,
          name: staffRow.name,
          email: staffRow.email,
          tenantId: staffRow.tenant_id,
          isAdmin: staffRow.is_admin,
          status: staffRow.status,
          departmentSlugs,
        },
      });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ status: "unauthenticated" });
      } else {
        load();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.status === "unauthenticated") {
      navigate({ to: "/login" });
    }
  }, [state.status, navigate]);

  return state;
}
