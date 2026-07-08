"use client";

/**
 * WFSC design system — transitions.
 *   PageTransition — soft fade/slide-up entrance for a whole view
 *   StepTransition — directional slide between wizard steps (re-animates
 *                    whenever `stepKey` changes)
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export function PageTransition({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`animate-page-in ${className}`.trim()}>{children}</div>;
}

export function StepTransition({
  stepKey,
  direction = "forward",
  className = "",
  children,
}: {
  /** Changing this key replays the entrance animation. */
  stepKey: string | number;
  direction?: "forward" | "back";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={stepKey}
      className={`${
        direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left"
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
