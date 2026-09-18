import { Check, CircleDashed, XCircle, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STEPS,
  statusLabel,
  type WorkOrderStatus,
} from "@/lib/work-order-status";

/**
 * Horizontal stage strip showing where a work order sits on the happy path.
 * Off-path statuses (rejected / complete / archived) render as a banner over
 * the last reached stage instead of pretending to be a linear step.
 */
export function WorkOrderStages({ status }: { status: string }) {
  const stepIndex = PIPELINE_STEPS.indexOf(status as WorkOrderStatus);
  const offPath = stepIndex === -1;

  // Where the WO got to before leaving the path.
  const effectiveIndex = offPath
    ? status === "complete"
      ? PIPELINE_STEPS.length - 1
      : status === "rejected"
        ? PIPELINE_STEPS.indexOf("pe_review")
        : -1 // archived / unknown: show nothing reached
    : stepIndex;

  return (
    <div className="space-y-2">
      {offPath && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
            status === "rejected" &&
              "border-hvhz-red/30 bg-hvhz-red-light text-hvhz-red",
            status === "complete" &&
              "border-hvhz-green/30 bg-hvhz-green-light text-hvhz-green",
            status === "archived" && "border-slate-200 bg-slate-100 text-slate-600"
          )}
        >
          {status === "rejected" && <XCircle className="h-3.5 w-3.5" />}
          {status === "complete" && <Check className="h-3.5 w-3.5" />}
          {status === "archived" && <Archive className="h-3.5 w-3.5" />}
          {statusLabel(status)}
          {status === "rejected" && " — sent back for revision"}
          {status === "archived" && " — out of the active pipeline"}
        </div>
      )}
      <ol className="flex items-center gap-0">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < effectiveIndex || (i === effectiveIndex && (status === "signed" || status === "complete"));
          const current = i === effectiveIndex && !done;
          return (
            <li key={step} className="flex flex-1 items-center min-w-0">
              <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] shrink-0",
                    done &&
                      "border-hvhz-teal bg-hvhz-teal text-white",
                    current &&
                      "border-hvhz-teal bg-hvhz-teal/10 text-hvhz-teal font-semibold",
                    !done && !current && "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : current ? i + 1 : <CircleDashed className="h-3.5 w-3.5" />}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight text-center truncate w-full",
                    current ? "text-hvhz-teal font-semibold" : done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {statusLabel(step)}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 min-w-2 -mt-4",
                    i < effectiveIndex ? "bg-hvhz-teal" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
