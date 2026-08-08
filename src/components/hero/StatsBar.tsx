import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";

const stats = [
  { value: "500+", label: "Projects Completed" },
  { value: "24hr", label: "Average Turnaround" },
  { value: "3", label: "Counties Served" },
  { value: "100%", label: "PE-Sealed Reports" },
];

export function StatsBar() {
  const { ref, isInView } = useInView();

  return (
    <section ref={ref} className="bg-card border-y px-6 py-12">
      <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "text-center",
              isInView ? "animate-count-up" : "opacity-0"
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <p className="font-display text-4xl font-bold text-primary tabular-nums tracking-tight">
              {stat.value}
            </p>
            <div className="mx-auto mt-2.5 h-0.5 w-8 bg-hvhz-teal/50 rounded-full" />
            <p className="mt-2.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
