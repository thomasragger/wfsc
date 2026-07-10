"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * Route-level error boundary (catches render errors below the root layout).
 * Reports to Sentry, then shows a warm, branded fallback with a retry.
 * The root layout's html/body still wrap this, so we render a light header
 * (logo only, no cart/data fetches) plus the mascot rather than the full nav.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <>
      <header className="border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label={t("error.logoAriaLabel")}>
            <Image
              src="/logo-landscape.png"
              alt={t("error.logoAlt")}
              width={1216}
              height={527}
              priority
              className="h-7 w-auto sm:h-8"
            />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:py-28">
        <Image
          src="/mascot/part1.png"
          alt=""
          aria-hidden="true"
          width={180}
          height={180}
          className="h-32 w-auto sm:h-40"
        />
        <Eyebrow className="mx-auto mt-6">{t("error.eyebrow")}</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("error.heading")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">{t("error.body")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()}>{t("error.tryAgain")}</Button>
          <ButtonLink href="/" variant="ghost">
            {t("error.backHome")}
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
