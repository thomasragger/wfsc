/**
 * WFSC design system — feedback.
 *   Alert — inline message (error / info / success tints)
 *   Toast — the same message floating above the page (fixed, bottom center)
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export type AlertTone = "error" | "info" | "success";

const TONE_CLASS: Record<AlertTone, string> = {
  error: "bg-coral/10 text-coral-deep",
  info: "bg-lavender/60 text-ink",
  success: "bg-sage/15 text-ink",
};

export function Alert({
  tone = "error",
  className = "",
  children,
}: {
  tone?: AlertTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl p-3 text-sm font-semibold ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </p>
  );
}

/** Floating variant — mount conditionally; it animates in on mount. */
export function Toast({
  tone = "success",
  className = "",
  inline = false,
  children,
}: {
  tone?: AlertTone;
  className?: string;
  /** Render in flow instead of floating — for previews/documentation. */
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        inline
          ? "pointer-events-none flex justify-center px-4"
          : "pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      }
    >
      <div
        role={tone === "error" ? "alert" : "status"}
        className={`animate-page-in pointer-events-auto rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-polaroid ring-1 ring-ink/5 ${className}`.trim()}
      >
        <span
          className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
            tone === "error" ? "bg-coral" : tone === "success" ? "bg-sage" : "bg-cobalt"
          }`}
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}
