import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";

interface CalcHeaderProps {
  title: string;
  workOrderId: string;
  address?: string;
  onSave: () => void;
  onReturn: () => void;
  saving: boolean;
  dirty: boolean;
}

export function CalcHeader({ title, workOrderId, address, onSave, onReturn, saving, dirty }: CalcHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => navigate(`/pe/review/${workOrderId}`)}>
        <ArrowLeft className="h-4 w-4" /> Back to Review
      </Button>
      <div className="hidden sm:flex items-center gap-2 text-sm">
        <span className="font-semibold text-primary">{title}</span>
        {address && <span className="text-muted-foreground text-xs truncate max-w-[260px]">· {address}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Button size="sm" onClick={onReturn} className="gap-1">
          Return <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
