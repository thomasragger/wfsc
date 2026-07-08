/**
 * WFSC design system — StepProgress.
 * The wizard's numbered progress rail: coral = current, sage ✓ = done.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export function StepProgress({
  steps,
  current,
  className = "",
}: {
  steps: readonly string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={`flex items-center justify-between gap-1 sm:gap-2 ${className}`.trim()} aria-label="Steps">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-1 last:flex-none sm:gap-2">
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold transition-colors ${
                  active
                    ? "bg-coral text-white"
                    : done
                      ? "bg-sage text-cream"
                      : "bg-white text-ink-soft ring-2 ring-ink/10"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:block ${active ? "text-ink" : "text-ink-soft"}`}
              >
                {label}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                className={`mb-0 h-0.5 flex-1 rounded-full sm:-mt-5 ${done ? "bg-sage" : "bg-ink/10"}`}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
