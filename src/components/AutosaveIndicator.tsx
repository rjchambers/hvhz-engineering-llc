import { Check, Loader2, CloudOff } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/useAutosave";

export function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] select-none animate-in">
      {status === "saving" && (
        <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Saving…</span></>
      )}
      {status === "saved" && (
        <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">Draft saved</span></>
      )}
      {status === "error" && (
        <><CloudOff className="h-3 w-3 text-destructive" /><span className="text-destructive">Save failed</span></>
      )}
    </div>
  );
}
