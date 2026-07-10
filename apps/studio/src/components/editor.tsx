"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import {
  FONT_PAIRINGS,
  LAYOUTS,
  fontStylesheetUrl,
  type FontPairingId,
  type LayoutId,
} from "@wfsc/book-engine";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, TextArea } from "@/components/ui/input";
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
  const t = useTranslations("editor");
  const [greeting, setGreeting] = useState(book.greeting ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = greeting !== (book.greeting ?? "");

  return (
    <Card className="p-6 sm:p-8">
      {/* Load every pairing's fonts so each option previews in its own face. */}
      {ALL_PAIRINGS.map((p) => (
        <link key={p.id} rel="stylesheet" href={fontStylesheetUrl(p)} />
      ))}

      <h2 className="font-display text-xl font-bold text-ink">{t("makeItYours")}</h2>

      <div className="mt-5">
        <Field label={t("greetingLabel")} htmlFor="greeting">
          <TextArea
            id="greeting"
            className="min-h-24"
            placeholder={t("greetingPlaceholder")}
            value={greeting}
            onChange={(e) => {
              setGreeting(e.target.value);
              setSaved(false);
            }}
            maxLength={600}
          />
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={!dirty}
            pending={saving}
            pendingLabel={t("saving")}
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
            {t("saveDedication")}
          </Button>
          {saved && !dirty ? (
            <span className="text-xs font-semibold text-sage">{t("saved")}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-7">
        <p className="mb-2 text-sm font-bold text-ink">{t("lettering")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label={t("fontPairingLabel")}>
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
                  {t("fontSample")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
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
  const t = useTranslations("editor");
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
    <Card className="p-6 sm:p-8">
      <h3 className="font-display text-lg font-bold text-ink">
        {spread.kind === "greeting" ? t("editDedication") : t("editPage")}
      </h3>

      <div className="mt-4">
        <Field label={t("storyText")} htmlFor={`spread-text-${spread.id}`}>
          <TextArea
            id={`spread-text-${spread.id}`}
            className="min-h-28"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1200}
          />
        </Field>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={!dirty}
          pending={savingText}
          pendingLabel={t("saving")}
          onClick={async () => {
            setSavingText(true);
            try {
              await onSaveText(text);
            } finally {
              setSavingText(false);
            }
          }}
        >
          {t("saveText")}
        </Button>
      </div>

      {isStory ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-ink">{t("layout")}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("pageLayoutLabel")}>
            {ALL_LAYOUTS.map((layout) => {
              const selected = spread.layout === layout.id;
              // Full-spread art is a different aspect ratio; switching into it
              // would need a freshly drawn illustration.
              const disabled =
                layout.id === "full-bleed-overlay" && spread.layout !== "full-bleed-overlay";
              return (
                <Chip
                  key={layout.id}
                  role="radio"
                  selected={selected}
                  disabled={disabled}
                  title={disabled ? t("fullSpreadDisabled") : layout.description}
                  onClick={() => onChangeLayout(layout.id)}
                >
                  {layout.name}
                </Chip>
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
              <p className="text-sm text-ink">{t("regenQueued")}</p>
            </div>
          ) : noteOpen ? (
            <div>
              <Field label={t("regenPrompt")} htmlFor={`regen-${spread.id}`}>
                <TextArea
                  id={`regen-${spread.id}`}
                  className="min-h-20"
                  placeholder={t("regenPlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={600}
                />
              </Field>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={note.trim().length < 3}
                  pending={regenState === "sending"}
                  pendingLabel={t("sending")}
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
                  {t("redraw")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNoteOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
              {t("askDifferent")}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
