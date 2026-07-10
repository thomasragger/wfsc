"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import type { FontPairingId, LayoutId } from "@wfsc/book-engine";

import { ArtPlaceholder } from "@/components/decor";
import { EditorPanel, SpreadEditor } from "@/components/editor";
import { Flipbook, type FlipPage } from "@/components/flipbook";
import { MagicHappening, StatusTimeline } from "@/components/status-views";
import { Alert } from "@/components/ui/alert";
import { CoverImage } from "@/components/ui/cover-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import type { BookFormat, BookPayload, BookStatus, PersonPayload } from "@/lib/book-payload";
import {
  addBookToCart,
  approveBook,
  getBook,
  patchBook,
  patchSpread,
  regenerateSpread,
  retryBook,
} from "@/lib/client-api";

// If generation runs past this without finishing, surface a reassuring
// "taking longer" message + a manual retry so the page never dead-ends.
const SLOW_PREVIEW_MS = 4 * 60 * 1000;

const POLLING_STATUSES: BookStatus[] = ["preview_generating", "purchased", "generating"];

// Human-readable name/blurb per format live in the "formats" namespace,
// keyed by id; only the stable id + price stay in code.
const FORMATS: { id: BookFormat; price: string }[] = [
  { id: "board", price: "€39" },
  { id: "softcover", price: "€49" },
  { id: "hardcover", price: "€69" },
];

export function BookHub({ token, initial }: { token: string; initial: BookPayload }) {
  const t = useTranslations("bookHub");
  const tf = useTranslations("formats");
  const [book, setBook] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [confirmedPeople, setConfirmedPeople] = useState<Set<string>>(
    () => new Set(initial.people.filter((p) => p.approved).map((p) => p.id)),
  );
  const [format, setFormat] = useState<BookFormat>(initial.format ?? "hardcover");
  const [checkingOut, setCheckingOut] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [zoomed, setZoomed] = useState<PersonPayload | null>(null);

  // Poll while the pipeline is working so the page moves forward on its own.
  useEffect(() => {
    if (!POLLING_STATUSES.includes(book.status)) return;
    const id = setInterval(() => {
      getBook(token)
        .then(setBook)
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [book.status, token]);

  // If preview generation drags on, offer reassurance + a retry rather than
  // spinning forever (the pipeline can stall if a job never gets picked up).
  // The retry handler resets `slow`; a stale true after a status change is
  // harmless since only the generating view reads it.
  useEffect(() => {
    if (book.status !== "preview_generating") return;
    const id = setTimeout(() => setSlow(true), SLOW_PREVIEW_MS);
    return () => clearTimeout(id);
  }, [book.status]);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      await retryBook(token);
      setSlow(false);
      setBook((b) => ({ ...b, status: "preview_generating" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.restart"));
    } finally {
      setRetrying(false);
    }
  }

  // The cover may live either on the book or as the position-0 spread.
  const coverImageUrl =
    book.coverImageUrl ?? book.spreads.find((s) => s.kind === "cover")?.imageUrl ?? null;
  const viewBook = useMemo(
    () => ({ ...book, coverImageUrl }),
    [book, coverImageUrl],
  );

  // Story spreads only — cover is the first page; the greeting becomes a
  // dedication front-matter page (below), not an inline spread.
  const interiorSpreads = useMemo(
    () => book.spreads.filter((s) => s.kind !== "cover" && s.kind !== "greeting"),
    [book.spreads],
  );

  // Cover → title page → dedication (personal note) → the story.
  const frontMatter: FlipPage[] = useMemo(() => {
    const greetingSpread = book.spreads.find((s) => s.kind === "greeting");
    const dedication = book.greeting ?? greetingSpread?.text ?? null;
    return [
      { kind: "title", title: book.title ?? t("defaultTitle"), styleName: book.style?.name ?? null },
      ...(dedication ? [{ kind: "dedication" as const, text: dedication, from: book.greetingFrom }] : []),
    ];
  }, [book.greeting, book.greetingFrom, book.title, book.style, book.spreads]);

  const isPreview = book.status === "preview_ready";

  const pages: FlipPage[] = useMemo(() => {
    if (!isPreview) {
      return [
        { kind: "cover" },
        ...frontMatter,
        ...interiorSpreads.map((spread) => ({ kind: "spread" as const, spread })),
      ];
    }
    // Preview gate: cover + front matter + the first two illustrated spreads
    // are free; every remaining spread renders as a locked teaser page.
    const unlocked = interiorSpreads.filter((s) => s.kind === "story" && s.imageUrl !== null).slice(0, 2);
    const morePages = Math.max(book.pageCount - unlocked.length * 2, 2);
    const remainingRows = interiorSpreads.length - unlocked.length;
    const lockedCount = Math.max(remainingRows, Math.ceil(morePages / 2));
    const result: FlipPage[] = [
      { kind: "cover" },
      ...frontMatter,
      ...unlocked.map((spread) => ({ kind: "spread" as const, spread })),
    ];
    for (let i = 0; i < lockedCount; i++) {
      result.push({ kind: "locked", morePages, variant: i });
    }
    return result;
  }, [isPreview, interiorSpreads, frontMatter, book.pageCount]);

  const currentPage = pages[Math.min(pageIndex, pages.length - 1)];
  const currentSpread = currentPage?.kind === "spread" ? currentPage.spread : null;

  // --- optimistic mutations -------------------------------------------------

  async function saveGreeting(greeting: string) {
    const prev = book;
    setBook((b) => ({ ...b, greeting }));
    setError(null);
    try {
      await patchBook(token, { greeting });
    } catch (err) {
      setBook(prev);
      setError(err instanceof Error ? err.message : t("errors.saveDedication"));
      throw err;
    }
  }

  function selectFontPairing(fontPairing: FontPairingId) {
    const prev = book;
    setBook((b) => ({ ...b, fontPairing }));
    setError(null);
    patchBook(token, { fontPairing }).catch((err: Error) => {
      setBook(prev);
      setError(err.message);
    });
  }

  async function saveSpreadText(spreadId: string, text: string) {
    const prev = book;
    setBook((b) => ({
      ...b,
      spreads: b.spreads.map((s) => (s.id === spreadId ? { ...s, text } : s)),
    }));
    setError(null);
    try {
      await patchSpread(token, spreadId, { text });
    } catch (err) {
      setBook(prev);
      setError(err instanceof Error ? err.message : t("errors.savePage"));
      throw err;
    }
  }

  function changeSpreadLayout(spreadId: string, layout: LayoutId) {
    const prev = book;
    setBook((b) => ({
      ...b,
      spreads: b.spreads.map((s) => (s.id === spreadId ? { ...s, layout } : s)),
    }));
    setError(null);
    patchSpread(token, spreadId, { layout }).catch((err: Error) => {
      setBook(prev);
      setError(err.message);
    });
  }

  async function requestRegeneration(spreadId: string, note: string) {
    setError(null);
    try {
      await regenerateSpread(token, spreadId, note);
      setBook((b) => ({
        ...b,
        spreads: b.spreads.map((s) => (s.id === spreadId ? { ...s, regenNote: note } : s)),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.queueRedraw"));
      throw err;
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    try {
      await addBookToCart(token, format);
      window.location.href = "/cart";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.addToCart"));
      setCheckingOut(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      await approveBook(token);
      setBook((b) => ({ ...b, status: "approved", approvedAt: new Date().toISOString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.approval"));
    } finally {
      setApproving(false);
      setConfirmApprove(false);
    }
  }

  // --- status views ----------------------------------------------------------

  if (book.status === "draft") {
    return (
      <Shell error={error}>
        <EmptyState
          doodle="sun.png"
          title={t("draft.title")}
          body={t("draft.body")}
          action={<ButtonLink href="/create">{t("draft.action")}</ButtonLink>}
        />
      </Shell>
    );
  }

  if (book.status === "preview_generating") {
    return (
      <Shell error={error}>
        <MagicHappening
          book={book}
          title={t("generating.title")}
          body={t("generating.body")}
        />
        {slow ? (
          <div className="mx-auto mt-8 max-w-md text-center">
            <p className="text-sm text-ink-soft">
              {t("generating.slow")}
            </p>
            <Button className="mt-4" variant="secondary" onClick={handleRetry} disabled={retrying}>
              {retrying ? t("generating.restarting") : t("generating.restart")}
            </Button>
          </div>
        ) : null}
      </Shell>
    );
  }

  if (book.status === "preview_failed") {
    return (
      <Shell error={error}>
        <EmptyState
          doodle="cloud.png"
          title={t("previewFailed.title")}
          body={t("previewFailed.body")}
          action={
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? t("previewFailed.retrying") : t("previewFailed.retry")}
            </Button>
          }
        />
      </Shell>
    );
  }

  if (book.status === "purchased" || book.status === "generating") {
    return (
      <Shell error={error}>
        <MagicHappening
          book={book}
          title={t("purchased.title")}
          body={t("purchased.body")}
        />
      </Shell>
    );
  }

  if (book.status === "generation_failed" || book.status === "print_failed") {
    return (
      <Shell error={error}>
        <EmptyState
          doodle="cloud.png"
          title={t("failed.title")}
          body={
            book.status === "generation_failed"
              ? t("failed.generation")
              : t("failed.print")
          }
        />
      </Shell>
    );
  }

  if (book.status === "cancelled") {
    return (
      <Shell error={error}>
        <EmptyState
          title={t("cancelled.title")}
          body={t("cancelled.body")}
          action={
            <ButtonLink href="/create" variant="secondary">
              {t("cancelled.action")}
            </ButtonLink>
          }
        />
      </Shell>
    );
  }

  if (
    book.status === "approved" ||
    book.status === "submitted_to_print" ||
    book.status === "shipped"
  ) {
    return (
      <Shell error={error}>
        <StatusTimeline book={book} />
        <div className="mt-12">
          <h2 className="mb-6 text-center font-display text-xl font-bold text-ink">
            {t("finished.readThrough")}
          </h2>
          <Flipbook book={viewBook} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />
        </div>
      </Shell>
    );
  }

  // preview_ready & ready_for_review share the flipbook shell.
  const allConfirmed = book.people.length === 0 || book.people.every((p) => confirmedPeople.has(p.id));

  // ---- preview_ready: a contained, two-column app view ---------------------
  if (isPreview) {
    return (
      <Shell error={error}>
        <div className="mb-6">
          <p className="text-sm font-semibold text-coral">{t("preview.ready")}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {book.title ?? t("defaultTitle")}
          </h1>
          {book.style ? (
            <p className="mt-1 text-sm text-ink-soft">
              {t.rich("styleCredit", {
                style: book.style.name,
                b: (chunks) => <span className="font-semibold">{chunks}</span>,
              })}
            </p>
          ) : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          {/* Left — the book */}
          <div className="min-w-0">
            <Flipbook book={viewBook} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />
          </div>

          {/* Right — action rail (sticky on desktop) */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
            {book.people.length > 0 ? (
              <Card className="p-5">
                <h2 className="font-display text-base font-extrabold text-ink">{t("preview.castTitle")}</h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {t("preview.castBody")}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {book.people.map((person) => {
                    const confirmed = confirmedPeople.has(person.id);
                    return (
                      <li key={person.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          className="group/av relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-lavender ring-2 ring-white disabled:cursor-default"
                          disabled={!person.characterSheetUrl}
                          aria-label={t("preview.viewUpClose", { name: person.name })}
                          onClick={() => person.characterSheetUrl && setZoomed(person)}
                        >
                          {person.characterSheetUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={person.characterSheetUrl}
                                alt={t("preview.characterAlt", { name: person.name })}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-[10px] font-bold text-transparent transition-colors group-hover/av:bg-ink/40 group-hover/av:text-white">
                                {t("preview.view")}
                              </span>
                            </>
                          ) : (
                            <ArtPlaceholder />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-bold text-ink">{person.name}</p>
                          {person.role ? <p className="text-[11px] text-ink-soft">{person.role}</p> : null}
                        </div>
                        <button
                          type="button"
                          aria-pressed={confirmed}
                          className={`shrink-0 rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors ${
                            confirmed ? "bg-sage text-cream" : "bg-marigold text-ink hover:bg-marigold-deep"
                          }`}
                          onClick={() =>
                            setConfirmedPeople((prev) => {
                              const next = new Set(prev);
                              if (confirmed) next.delete(person.id);
                              else next.add(person.id);
                              return next;
                            })
                          }
                        >
                          {confirmed ? t("preview.looksRightYes") : t("preview.looksRight")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            <Card className="p-5" id="unlock">
              <h2 className="font-display text-base font-extrabold text-ink">{t("preview.unlockTitle")}</h2>
              <div className="mt-4 flex flex-col gap-3" role="radiogroup" aria-label={t("preview.formatGroupLabel")}>
                {FORMATS.map((f) => {
                  const selected = format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFormat(f.id)}
                      className={`rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                        selected ? "border-coral shadow-fuzzy" : "border-ink/10 hover:border-marigold"
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-display font-bold text-ink">{tf(`${f.id}.name`)}</span>
                        <span className="font-display text-lg font-extrabold text-coral">{f.price}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">{tf(`${f.id}.blurb`)}</p>
                    </button>
                  );
                })}
              </div>
              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={!allConfirmed}
                pending={checkingOut}
                pendingLabel={t("preview.checkoutPending")}
                onClick={() => void checkout()}
              >
                {t("preview.createBook")}
              </Button>
              <p className="mt-2 text-center text-xs text-ink-soft">
                {allConfirmed
                  ? t("preview.secureNote")
                  : t("preview.confirmCastFirst")}
              </p>
            </Card>
          </aside>
        </div>

        {zoomed?.characterSheetUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("preview.personUpClose", { name: zoomed.name })}
            onClick={() => setZoomed(null)}
          >
            <div className="animate-fade-in absolute inset-0 bg-ink/50 backdrop-blur-sm" />
            <div className="animate-page-in relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="overflow-hidden rounded-3xl bg-cream shadow-polaroid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={zoomed.characterSheetUrl} alt={t("preview.characterAlt", { name: zoomed.name })} className="w-full" />
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-display text-lg font-extrabold text-ink">{zoomed.name}</p>
                    {zoomed.role ? <p className="text-xs text-ink-soft">{zoomed.role}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-ink/5 px-4 py-2 text-sm font-bold text-ink hover:bg-ink/10"
                    onClick={() => setZoomed(null)}
                  >
                    {t("preview.close")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Shell>
    );
  }

  // ---- ready_for_review: the full editor + approval ------------------------
  return (
    <Shell error={error}>
      <header className="mb-10 flex flex-col items-center text-center">
        <CoverImage src={coverImageUrl} alt={t("review.coverAlt")} size="md" priority className="mb-7" />
        <p className="text-sm font-semibold text-coral">{t("review.ready")}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
          {book.title ?? t("defaultTitle")}
        </h1>
        {book.style ? (
          <p className="mt-1 text-sm text-ink-soft">
            {t.rich("styleCredit", {
              style: book.style.name,
              b: (chunks) => <span className="font-semibold">{chunks}</span>,
            })}
          </p>
        ) : null}
      </header>

      <Flipbook book={viewBook} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />

      {currentSpread ? (
        <div className="mx-auto mt-8 max-w-3xl">
          <SpreadEditor
            key={currentSpread.id}
            spread={currentSpread}
            onSaveText={(text) => saveSpreadText(currentSpread.id, text)}
            onChangeLayout={(layout) => changeSpreadLayout(currentSpread.id, layout)}
            onRegenerate={(note) => requestRegeneration(currentSpread.id, note)}
          />
        </div>
      ) : null}

      <div className="mx-auto mt-8 max-w-3xl">
        <EditorPanel book={book} onSaveGreeting={saveGreeting} onSelectFontPairing={selectFontPairing} />
      </div>

      <section className="mx-auto mt-12 max-w-3xl">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <h2 className="font-display text-xl font-bold text-ink">{t("review.happyTitle")}</h2>
          {confirmApprove ? (
            <>
              <p className="max-w-md text-sm text-ink-soft">
                {t("review.confirmBody")}
              </p>
              <div className="flex gap-3">
                <Button pending={approving} pendingLabel={t("review.approving")} onClick={() => void approve()}>
                  {t("review.printYes")}
                </Button>
                <Button variant="ghost" disabled={approving} onClick={() => setConfirmApprove(false)}>
                  {t("review.keepEditing")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="max-w-md text-sm text-ink-soft">
                {t("review.reviewBody")}
              </p>
              <Button onClick={() => setConfirmApprove(true)}>{t("review.approve")}</Button>
            </>
          )}
        </Card>
      </section>
    </Shell>
  );
}

function Shell({ children, error }: { children: React.ReactNode; error: string | null }) {
  return (
    <PageTransition className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {error ? <Alert className="mx-auto mb-6 max-w-2xl text-center">{error}</Alert> : null}
      {children}
    </PageTransition>
  );
}
