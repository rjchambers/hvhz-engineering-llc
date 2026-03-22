import { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  step: number;
  title: string;
  description?: string;
  icon: LucideIcon;
  isOpen: boolean;
  isComplete: boolean;
  onToggle: () => void;
  children: ReactNode;
  hasError?: boolean;
}

export function FormSection({
  step,
  title,
  description,
  icon: Icon,
  isOpen,
  isComplete,
  onToggle,
  children,
  hasError,
}: FormSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div
        className={cn(
          "rounded-xl border bg-card transition-all duration-200",
          isOpen ? "border-hvhz-teal/50 shadow-md" : "border-border",
          hasError && "border-destructive/50"
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 md:p-5 text-left">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
              isComplete
                ? "bg-hvhz-green text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isComplete ? <Check className="h-4 w-4" /> : step}
          </div>
          <Icon className="h-4 w-4 shrink-0 text-hvhz-teal" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">{title}</p>
            {description && (
              <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-5 md:px-5 md:pb-6 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
