/**
 * WFSC design system — form controls.
 * Field (label + control + hint), TextInput, TextArea, Select — all in the
 * rounded "pill" brand style. Never hand-roll an <input> outside these.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export function Field({
  label,
  htmlFor,
  hint,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-soft"> (optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { pill?: boolean };

export function TextInput({ pill = false, className = "", ...rest }: InputProps) {
  return <input className={`input ${pill ? "input-pill" : ""} ${className}`.trim()} {...rest} />;
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = "", ...rest }: TextAreaProps) {
  return <textarea className={`input resize-y ${className}`.trim()} {...rest} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select className={`input appearance-none pr-10 ${className}`.trim()} {...rest}>
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
