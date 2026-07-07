"use client";

import { useState } from "react";

import {
  FONT_PAIRINGS,
  LAYOUTS,
  fontStylesheetUrl,
  type FontPairingId,
  type LayoutId,
} from "@wfsc/book-engine";

import type { BookPayload, SpreadPayload } from "@/lib/book-payload";

const ALL_PAIRINGS = Object.values(FONT_PAIRINGS);
const ALL_LAYOUTS = Object.values(LAYOUTS);

/** Book-level editor: dedication text + font pairing. */
export function EditorPanel({
  book,
  onSaveGreeting,
  onSelectFontPairing,
}: {
  book: BookPayload;
  onSaveGreeting: (greeting: string) => Promise<void>;
  onSelectFontPairing: (id: FontPairingId) => void;
}) {
  const [greeting, setGreeting] = useState(book.greeting ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = greeting !== (book.greeting ?? "");

  return (
    <section className="card p-6 sm:p-8">
      {/* Load every pairing's fonts so each option previews in its own face. */}
      {ALL_PAIRINGS.map((p) => (
        <link key={p.id} rel="stylesheet" href={fontStylesheetUrl(p)} />
      ))}

      <h2 className="font-display text-xl font-bold text-ink">Make it yours</h2>

      <div className="mt-5">
        <label htmlFor="greeting" className="mb-1.5 block text-sm font-bold text-ink">
          Greeting &amp; dedication
        </label>
        <textarea
          id="greeting"
          className="input min-h-24 resize-y"
          placeholder={"For Mia —\nso you never forget the summer of the lighthouse.\nLove, Nana"}
          value={greeting}
          onChange={(e) => {
            setGreeting(e.target.value);
            setSaved(false);
          }}
          maxLength={600}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="btn btn-marigold px-4 py-2 text-sm"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSaveGreeting(greeting);
                setSaved(true);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save dedication"}
          </button>
          {saved && !dirty ? (
            <span className="text-xs font-semibold text-sage">Saved ✓</span>
          ) : null}
        </div>
      </div>

      <div className="mt-7">
        <p className="mb-2 text-sm font-bold text-ink">Lettering</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Font pairing">
          {ALL_PAIRINGS.map((pairing) => {
            const selected = book.fontPairing === pairing.id;
            return (
              <button
                key={pairing.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelectFontPairing(pairing.id)}
                className={`rounded-2xl border-2 bg-white px-3 py-4 text-center transition-colors ${
                  selected ? "border-coral shadow-fuzzy" : "border-ink/10 hover:border-marigold"
                }`}
              >
                <span
                  className="block text-xl leading-tight text-ink"
                  style={{
                    fontFamily: `'${pairing.display.family}', sans-serif`,
                    fontWeight: pairing.display.weight,
                  }}
                >
                  {pairing.name}
                </span>
                <span
                  className="mt-1 block text-[11px] text-ink-soft"
                  style={{
                    fontFamily: `'${pairing.body.family}', sans-serif`,
                    fontWeight: pairing.body.weight,
                  }}
                >
                  Once upon a time…
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Per-spread editor: story text, layout, regenerate-with-note. */
export function SpreadEditor({
  spread,
  onSaveText,
  onChangeLayout,
  onRegenerate,
}: {
  spread: SpreadPayload;
  onSaveText: (text: string) => Promise<void>;
  onChangeLayout: (layout: LayoutId) => void;
  onRegenerate: (note: string) => Promise<void>;
}) {
  const [text, setText] = useState(spread.text ?? "");
  const [savingText, setSavingText] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [regenState, setRegenState] = useState<"idle" | "sending" | "queued">(
    spread.regenNote ? "queued" : "idle",
  );
  const dirty = text !== (spread.text ?? "");
  const isStory = spread.kind === "story";

  return (
    <section className="card p-6 sm:p-8">
      <h3 className="font-display text-lg font-bold text-ink">
        Edit this {spread.kind === "greeting" ? "dedication" : "page"}
      </h3>

      <div className="mt-4">
        <label htmlFor={`spread-text-${spread.id}`} className="mb-1.5 block text-sm font-bold text-ink">
          Story text
        </label>
        <textarea
          id={`spread-text-${spread.id}`}
          className="input min-h-28 resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1200}
        />
        <button
          type="button"
          className="btn btn-marigold mt-2 px-4 py-2 text-sm"
          disabled={!dirty || savingText}
          onClick={async () => {
            setSavingText(true);
            try {
              await onSaveText(text);
            } finally {
              setSavingText(false);
            }
          }}
        >
          {savingText ? "Saving…" : "Save text"}
        </button>
      </div>

      {isStory ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-ink">Layout</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Page layout">
            {ALL_LAYOUTS.map((layout) => {
              const selected = spread.layout === layout.id;
              // Full-spread art is a different aspect ratio; switching into it
              // would need a freshly drawn illustration.
              const disabled =
                layout.id === "full-bleed-overlay" && spread.layout !== "full-bleed-overlay";
              return (
                <button
                  key={layout.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  title={
                    disabled
                      ? "This page's illustration doesn't fit the full-spread layout"
                      : layout.description
                  }
                  onClick={() => onChangeLayout(layout.id)}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-coral bg-coral text-cream"
                      : "border-ink/15 bg-white text-ink hover:border-marigold"
                  }`}
                >
                  {layout.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isStory ? (
        <div className="mt-6 border-t border-ink/10 pt-5">
          {regenState === "queued" ? (
            <div className="flex items-start gap-3 rounded-2xl bg-lavender/70 p-4">
              <span className="text-lg" aria-hidden="true">
                ✨
              </span>
              <p className="text-sm text-ink">
                A new illustration for this page is being drawn. It&rsquo;ll appear here when
                it&rsquo;s ready.
              </p>
            </div>
          ) : noteOpen ? (
            <div>
              <label htmlFor={`regen-${spread.id}`} className="mb-1.5 block text-sm font-bold text-ink">
                What should our illustrators change?
              </label>
              <textarea
                id={`regen-${spread.id}`}
                className="input min-h-20 resize-y"
                placeholder="e.g. Mia should be wearing her yellow raincoat, and it should be evening"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={600}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-coral px-4 py-2 text-sm"
                  disabled={note.trim().length < 3 || regenState === "sending"}
                  onClick={async () => {
                    setRegenState("sending");
                    try {
                      await onRegenerate(note.trim());
                      setRegenState("queued");
                    } catch {
                      setRegenState("idle");
                    }
                  }}
                >
                  {regenState === "sending" ? "Sending…" : "Redraw this illustration"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-4 py-2 text-sm"
                  onClick={() => setNoteOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost px-4 py-2 text-sm"
              onClick={() => setNoteOpen(true)}
            >
              ✏️ Ask for a different illustration
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
