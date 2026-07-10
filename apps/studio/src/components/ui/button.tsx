/**
 * WFSC design system — Button / ButtonLink.
 * The only way to render a CTA in the app. Variants map to the brand pills:
 *   primary   — flat coral pill, white text, deep-rust hover (theme CTA)
 *   secondary — marigold pill with a chunky pressed-shadow
 *   ghost     — quiet white pill for secondary actions
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

import { Link } from "@/i18n/navigation";
import { Spinner } from "@/components/ui/spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn btn-coral",
  secondary: "btn btn-marigold",
  ghost: "btn btn-ghost",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "", // .btn default padding
  lg: "px-8 py-3.5 text-lg",
};

function classes(variant: ButtonVariant, size: ButtonSize, className: string) {
  return `${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim();
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button while an async action runs. */
  pending?: boolean;
  /** Label shown while pending (defaults to children). */
  pendingLabel?: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  pendingLabel,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? (
        <>
          <Spinner size="sm" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

/** Link styled as a button. Uses the locale-aware Link for internal routes, <a> for external. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  const cls = classes(variant, size, className);
  if (/^(https?:)?\/\//.test(href)) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
