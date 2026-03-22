interface CalcDerivationProps {
  lines: string[];
}

export function CalcDerivation({ lines }: CalcDerivationProps) {
  return (
    <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-1">
      {lines.map((line, i) => (
        <p key={i} className={line.startsWith("**") ? "font-bold" : ""}>
          {line.replace(/^\*\*|\*\*$/g, "")}
        </p>
      ))}
    </div>
  );
}
