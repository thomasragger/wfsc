"use client";

import { useEffect, useMemo, useState } from "react";

import type { FontPairingId, LayoutId } from "@wfsc/book-engine";

import { ArtPlaceholder } from "@/components/decor";
import { EditorPanel, SpreadEditor } from "@/components/editor";
import { Flipbook, type FlipPage } from "@/components/flipbook";
import { MagicHappening, StatusTimeline } from "@/components/status-views";
import { Alert } from "@/components/ui/alert";
import { BookMockup } from "@/components/ui/book-mockup";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import type { BookFormat, BookPayload, BookStatus } from "@/lib/book-payload";
import {
  approveBook,
  getBook,
  patchBook,
  patchSpread,
  regenerateSpread,
  startCheckout,
} from "@/lib/client-api";

const POLLING_STATUSES: BookStatus[] = ["preview_generating", "purchased", "generating"];

const FORMATS: { id: BookFormat; name: string; price: string; blurb: string }[] = [
  {
    id: "softcover",
    name: "Softcover",
    price: "€49",
    blurb: "Light and lovely — perfect for little hands.",
  },
  {
    id: "hardcover",
    name: "Hardcover",
    price: "€69",
    blurb: "The keepsake edition, built for a thousand bedtimes.",
  },
];

export function BookHub({ token, initial }: { token: string; initial: BookPayload }) {
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

  // The cover may live either on the book or as the position-0 spread.
  const coverImageUrl =
    book.coverImageUrl ?? book.spreads.find((s) => s.kind === "cover")?.imageUrl ?? null;
  const viewBook = useMemo(
    () => ({ ...book, coverImageUrl }),
    [book, coverImageUrl],
  );

  const interiorSpreads = useMemo(
    () => book.spreads.filter((s) => s.kind !== "cover"),
    [book.spreads],
  );

  const isPreview = book.status === "preview_ready";

  const pages: FlipPage[] = useMemo(() => {
    if (!isPreview) {
      return [
        { kind: "cover" },
        ...interiorSpreads.map((spread) => ({ kind: "spread" as const, spread })),
      ];
    }
    // Preview gate: cover + the first two illustrated spreads are free;
    // every remaining spread of the book renders as a locked teaser page.
    const unlocked = interiorSpreads.filter((s) => s.kind === "story" && s.imageUrl !== null).slice(0, 2);
    const morePages = Math.max(book.pageCount - unlocked.length * 2, 2);
    const remainingRows = interiorSpreads.length - unlocked.length;
    const lockedCount = Math.max(remainingRows, Math.ceil(morePages / 2));
    const result: FlipPage[] = [
      { kind: "cover" },
      ...unlocked.map((spread) => ({ kind: "spread" as const, spread })),
    ];
    for (let i = 0; i < lockedCount; i++) {
      result.push({ kind: "locked", morePages, variant: i });
    }
    return result;
  }, [isPreview, interiorSpreads, book.pageCount]);

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
      setError(err instanceof Error ? err.message : "Couldn't save your dedication");
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
      setError(err instanceof Error ? err.message : "Couldn't save this page");
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
      setError(err instanceof Error ? err.message : "Couldn't queue the redraw");
      throw err;
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    try {
      const url = await startCheckout(token, format);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed — please try again");
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
      setError(err instanceof Error ? err.message : "Approval failed — please try again");
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
          title="This book is still a twinkle in our eye"
          body="It looks like the story intake wasn't finished. Start again and it only takes about five minutes."
          action={<ButtonLink href="/create">Start your book</ButtonLink>}
        />
      </Shell>
    );
  }

  if (book.status === "preview_generating") {
    return (
      <Shell error={error}>
        <MagicHappening
          book={book}
          title="The magic is happening…"
          body="Our illustrators are sketching your characters and painting the first pages of your story. This usually takes a few minutes."
        />
      </Shell>
    );
  }

  if (book.status === "purchased" || book.status === "generating") {
    return (
      <Shell error={error}>
        <MagicHappening
          book={book}
          title="Your whole book is being illustrated"
          body="Thank you for your order! Every page of your story is now being written and painted. We'll email you the moment it's ready for your review."
        />
      </Shell>
    );
  }

  if (book.status === "cancelled") {
    return (
      <Shell error={error}>
        <EmptyState
          title="This order was cancelled"
          body="Your story is safe with us. If this was a mistake or you'd like to pick up where you left off, just reply to any of our emails."
          action={
            <ButtonLink href="/create" variant="secondary">
              Start a new book
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
            One more read-through?
          </h2>
          <Flipbook book={viewBook} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />
        </div>
      </Shell>
    );
  }

  // preview_ready & ready_for_review share the flipbook shell.
  const allConfirmed = book.people.length === 0 || book.people.every((p) => confirmedPeople.has(p.id));

  return (
    <Shell error={error}>
      <header className="mb-10 flex flex-col items-center text-center">
        <BookMockup
          coverUrl={coverImageUrl}
          title={book.title ?? "Your storybook"}
          size="md"
          alt="Your book's cover"
          priority
          className="mb-7"
        />
        <p className="text-sm font-semibold text-coral">
          {isPreview ? "Your preview is ready!" : "Your book is ready for review"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
          {book.title ?? "Your storybook"}
        </h1>
        {book.style ? (
          <p className="mt-1 text-sm text-ink-soft">
            Illustrated in the <span className="font-semibold">{book.style.name}</span> style
          </p>
        ) : null}
      </header>

      {isPreview && book.people.length > 0 ? (
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold text-ink">Meet your characters</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Check that everyone looks like themselves before we illustrate the whole book.
          </p>
          <div className="mt-5 flex flex-wrap gap-5">
            {book.people.map((person, i) => {
              const confirmed = confirmedPeople.has(person.id);
              return (
                <div
                  key={person.id}
                  className={`polaroid w-40 ${i % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
                >
                  <div className="aspect-square overflow-hidden rounded-sm bg-lavender">
                    {person.characterSheetUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.characterSheetUrl}
                        alt={`${person.name} as a storybook character`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ArtPlaceholder label="Being drawn…" />
                    )}
                  </div>
                  <div className="pt-2 text-center">
                    <p className="font-display text-sm font-bold text-ink">{person.name}</p>
                    {person.role ? <p className="text-[11px] text-ink-soft">{person.role}</p> : null}
                    <button
                      type="button"
                      className={`mt-2 w-full rounded-full px-2 py-1.5 font-display text-xs font-bold transition-colors ${
                        confirmed
                          ? "bg-sage text-cream"
                          : "bg-marigold text-ink hover:bg-marigold-deep"
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
                      {confirmed ? "Looks right ✓" : "Looks right?"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <Flipbook book={viewBook} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />

      {!isPreview && currentSpread ? (
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

      {!isPreview ? (
        <div className="mx-auto mt-8 max-w-3xl">
          <EditorPanel
            book={book}
            onSaveGreeting={saveGreeting}
            onSelectFontPairing={selectFontPairing}
          />
        </div>
      ) : null}

      {isPreview ? (
        <section id="unlock" className="mx-auto mt-14 max-w-3xl scroll-mt-24">
          <h2 className="text-center font-display text-2xl font-bold text-ink">
            Love it? Let&rsquo;s print the whole story.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FORMATS.map((f) => {
              const selected = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFormat(f.id)}
                  className={`rounded-2xl border-2 bg-white p-6 text-left transition-all ${
                    selected ? "border-coral shadow-fuzzy" : "border-ink/10 hover:border-marigold"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-lg font-bold text-ink">{f.name}</span>
                    <span className="font-display text-xl font-extrabold text-coral">{f.price}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{f.blurb}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button
              size="lg"
              disabled={!allConfirmed}
              pending={checkingOut}
              pendingLabel="Taking you to checkout…"
              onClick={() => void checkout()}
            >
              Create my book
            </Button>
            {!allConfirmed ? (
              <p className="text-xs font-semibold text-ink-soft">
                First confirm your characters above so we illustrate the right people.
              </p>
            ) : (
              <p className="text-xs text-ink-soft">
                Secure checkout · Printed &amp; shipped to your door
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-12 max-w-3xl">
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-ink">Happy with every page?</h2>
            {confirmApprove ? (
              <>
                <p className="max-w-md text-sm text-ink-soft">
                  Once you approve, we prepare the print files and send your book to press —
                  no more changes after this point.
                </p>
                <div className="flex gap-3">
                  <Button
                    pending={approving}
                    pendingLabel="Approving…"
                    onClick={() => void approve()}
                  >
                    Yes, print my book!
                  </Button>
                  <Button variant="ghost" disabled={approving} onClick={() => setConfirmApprove(false)}>
                    Keep editing
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="max-w-md text-sm text-ink-soft">
                  Flip through every page, tweak anything you like, then send it to print.
                </p>
                <Button onClick={() => setConfirmApprove(true)}>Approve for printing</Button>
              </>
            )}
          </Card>
        </section>
      )}
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
