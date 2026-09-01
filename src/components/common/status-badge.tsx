import { cn } from "@/lib/utils";
import type { DocStatus } from "@/lib/mock-data";
import { statusLabel } from "@/lib/mock-data";

const styles: Record<DocStatus, string> = {
  em_dia: "bg-success/15 text-success border-success/30",
  pendente: "bg-warning/20 text-warning-foreground border-warning/40",
  atrasado: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "em_dia" && "bg-success",
          status === "pendente" && "bg-warning",
          status === "atrasado" && "bg-destructive",
        )}
      />
      {statusLabel(status)}
    </span>
  );
}
