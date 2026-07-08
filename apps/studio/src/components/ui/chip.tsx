/**
 * WFSC design system — chips & pills.
 *   Chip      — selectable pill (radio-style option: layouts, ages, formats)
 *   PillLabel — small white label pill (category tiles, template chips)
 *   Tag       — tiny tinted label (sample category tags)
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

type ChipProps = {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
  /** Set when the chip belongs to a radiogroup. */
  role?: "radio";
};

export function Chip({
  selected = false,
  disabled = false,
  onClick,
  title,
  className = "",
  children,
  role,
}: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "radio" ? selected : undefined}
      aria-pressed={role !== "radio" ? selected : undefined}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-1.5 font-display text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-cobalt focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-coral bg-coral text-white"
          : "border-ink/15 bg-white text-ink hover:border-marigold"
      } ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function PillLabel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={`pill-label ${className}`.trim()}>{children}</span>;
}

export function Tag({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full bg-lavender px-2.5 py-0.5 text-[10px] font-bold text-cobalt ${className}`.trim()}
    >
      {children}
    </span>
  );
}
