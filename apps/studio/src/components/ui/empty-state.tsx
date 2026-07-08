/**
 * WFSC design system — EmptyState.
 * A friendly card for "nothing here yet" and not-found moments: doodle,
 * headline, one direction-giving line, optional CTA.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { Doodle } from "@/components/decor";
import { Card } from "@/components/ui/card";

export function EmptyState({
  doodle = "cloud.png",
  title,
  body,
  action,
  className = "",
}: {
  doodle?: string;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center sm:p-12 ${className}`.trim()}>
      <Doodle src={doodle} size={56} className="animate-float" />
      <p className="max-w-md font-display text-lg font-extrabold text-ink">{title}</p>
      {body ? <div className="max-w-md text-sm leading-relaxed text-ink-soft">{body}</div> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </Card>
  );
}
