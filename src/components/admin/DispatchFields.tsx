import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { RoleUser } from "@/hooks/useWorkOrders";

export interface DispatchValues {
  technicianId: string;
  engineerId: string;
  date: Date | undefined;
}

interface Props {
  techs: RoleUser[];
  engineers: RoleUser[];
  value: DispatchValues;
  onChange: (value: DispatchValues) => void;
  techRequired?: boolean;
}

/**
 * The technician / engineer / scheduled-date triplet used by both the single
 * dispatch card and the bulk dispatch dialog.
 */
export function DispatchFields({ techs, engineers, value, onChange, techRequired }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Technician{techRequired ? " *" : ""}</Label>
        <Select
          value={value.technicianId}
          onValueChange={(v) => onChange({ ...value, technicianId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select technician" />
          </SelectTrigger>
          <SelectContent>
            {techs.map((t) => (
              <SelectItem key={t.user_id} value={t.user_id}>
                {t.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Engineer / PE</Label>
        <Select
          value={value.engineerId}
          onValueChange={(v) => onChange({ ...value, engineerId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select engineer" />
          </SelectTrigger>
          <SelectContent>
            {engineers.map((e) => (
              <SelectItem key={e.user_id} value={e.user_id}>
                {e.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Scheduled Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !value.date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value.date ? format(value.date, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.date}
              onSelect={(d) => onChange({ ...value, date: d })}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
