"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtPlaceholder, Sparkle } from "@/components/decor";
import { PERSON_ROLES, type PersonRole } from "@/lib/book-payload";
import {
  createBook,
  getStyles,
  getTemplate,
  uploadPhoto,
  type StyleSummary,
  type TemplateSummary,
} from "@/lib/client-api";

const STEPS = ["Your story", "Who's in it", "Pick a style", "Your email"] as const;

const ROLE_LABELS: Record<PersonRole, string> = {
  child: "Child",
  mama: "Mama",
  papa: "Papa",
  grandma: "Grandma",
  grandpa: "Grandpa",
  sibling: "Sibling",
  friend: "Friend",
  other: "Someone else",
};

const MEMORY_PROMPTS = [
  "The summer we built a den in grandpa's garden and refused to come inside, even for dinner…",
  "Every Sunday, papa makes pancakes shaped like animals. Last week he attempted a giraffe…",
  "The day Mia's training wheels came off, the whole street cheered…",
];

interface PersonDraft {
  key: string;
  name: string;
  role: PersonRole;
  photoUrls: string[];
  uploading: number;
}

function newPerson(role: PersonRole = "child"): PersonDraft {
  return { key: crypto.randomUUID(), name: "", role, photoUrls: [], uploading: 0 };
}

export function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [step, setStep] = useState(0);
  const [memoryText, setMemoryText] = useState("");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [people, setPeople] = useState<PersonDraft[]>([newPerson()]);
  const [styles, setStyles] = useState<StyleSummary[] | null>(null);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Optional template preselect from ?template=
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    getTemplate(templateId)
      .then((tpl) => {
        if (cancelled) return;
        setTemplate(tpl);
        if (tpl.suggestedStyleId) {
          setStyleId((current) => current ?? tpl.suggestedStyleId);
        }
      })
      .catch(() => undefined); // template is a nice-to-have, never a blocker
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  useEffect(() => {
    getStyles()
      .then(setStyles)
      .catch((err: Error) => setStylesError(err.message));
  }, []);

  const uploadsInFlight = people.some((p) => p.uploading > 0);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return memoryText.trim().length >= 20;
      case 1:
        return (
          people.length >= 1 &&
          people.every((p) => p.name.trim().length > 0 && p.photoUrls.length >= 1) &&
          !uploadsInFlight
        );
      case 2:
        return styleId !== null;
      case 3:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      default:
        return false;
    }
  }, [step, memoryText, people, uploadsInFlight, styleId, email]);

  function goTo(next: number) {
    setError(null);
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function updatePerson(key: string, patch: Partial<PersonDraft>) {
    setPeople((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function addPhotos(person: PersonDraft, files: FileList | null) {
    if (!files) return;
    const room = 3 - person.photoUrls.length;
    const selection = Array.from(files).slice(0, room);
    if (selection.length === 0) return;
    setError(null);
    updatePerson(person.key, { uploading: person.uploading + selection.length });
    for (const file of selection) {
      try {
        const url = await uploadPhoto(file);
        setPeople((prev) =>
          prev.map((p) =>
            p.key === person.key
              ? { ...p, photoUrls: [...p.photoUrls, url].slice(0, 3), uploading: p.uploading - 1 }
              : p,
          ),
        );
      } catch (err) {
        setPeople((prev) =>
          prev.map((p) => (p.key === person.key ? { ...p, uploading: p.uploading - 1 } : p)),
        );
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    }
  }

  async function submit() {
    if (!styleId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await createBook({
        memoryText: memoryText.trim(),
        title: title.trim() || undefined,
        templateId: template?.id,
        styleId,
        email: email.trim(),
        people: people.map((p) => ({
          name: p.name.trim(),
          role: p.role,
          photoUrls: p.photoUrls,
        })),
      });
      router.push(`/book/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
      setSubmitting(false);
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progress */}
      <ol className="mb-8 flex items-center justify-between gap-1 sm:gap-2" aria-label="Steps">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-1 last:flex-none sm:gap-2">
              <span className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold transition-colors ${
                    active
                      ? "bg-coral text-cream"
                      : done
                        ? "bg-sage text-cream"
                        : "bg-white text-ink-soft ring-2 ring-ink/10"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-semibold sm:block ${active ? "text-ink" : "text-ink-soft"}`}
                >
                  {label}
                </span>
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={`mb-0 h-0.5 flex-1 rounded-full sm:-mt-5 ${done ? "bg-sage" : "bg-ink/10"}`}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="card p-6 sm:p-10">
        {step === 0 && (
          <section className="flex flex-col gap-5">
            <header>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Tell us your story
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Write it like you&rsquo;d tell it at bedtime — the little details are what make
                the magic.
              </p>
            </header>

            {template ? (
              <div className="flex items-start gap-3 rounded-2xl bg-lavender/70 p-4">
                <Sparkle className="mt-0.5 shrink-0 text-cobalt" size={18} />
                <div>
                  <p className="text-sm font-bold text-ink">
                    Starting from: {template.title}
                  </p>
                  {template.description ?? template.tagline ? (
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {template.description ?? template.tagline}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div>
              <label htmlFor="memory" className="mb-1.5 block text-sm font-bold text-ink">
                Your memory
              </label>
              <textarea
                id="memory"
                className="input min-h-44 resize-y leading-relaxed"
                placeholder={MEMORY_PROMPTS[0]}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                Need a nudge? &ldquo;{MEMORY_PROMPTS[1]}&rdquo;
              </p>
            </div>

            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-bold text-ink">
                Book title <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="title"
                className="input"
                placeholder="We'll suggest one if you leave this empty"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-5">
            <header>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Who&rsquo;s in it?
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Add up to four people, with 1&ndash;3 photos each. Clear, well-lit photos of
                their face work best.
              </p>
            </header>

            <div className="flex flex-col gap-4">
              {people.map((person, idx) => (
                <div key={person.key} className="rounded-2xl border-2 border-ink/10 bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-sm font-bold text-ink-soft">
                      Person {idx + 1}
                    </p>
                    {people.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-coral hover:underline"
                        onClick={() =>
                          setPeople((prev) => prev.filter((p) => p.key !== person.key))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`name-${person.key}`}
                        className="mb-1.5 block text-sm font-bold text-ink"
                      >
                        Name
                      </label>
                      <input
                        id={`name-${person.key}`}
                        className="input"
                        placeholder="Mia"
                        value={person.name}
                        maxLength={80}
                        onChange={(e) => updatePerson(person.key, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`role-${person.key}`}
                        className="mb-1.5 block text-sm font-bold text-ink"
                      >
                        Role in the story
                      </label>
                      <select
                        id={`role-${person.key}`}
                        className="input appearance-none"
                        value={person.role}
                        onChange={(e) =>
                          updatePerson(person.key, { role: e.target.value as PersonRole })
                        }
                      >
                        {PERSON_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {person.photoUrls.map((url) => (
                      <div key={url} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo of ${person.name || "person"}`}
                          className="h-20 w-20 rounded-xl object-cover shadow-fuzzy"
                        />
                        <button
                          type="button"
                          aria-label="Remove photo"
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-cream opacity-90 hover:bg-coral"
                          onClick={() =>
                            updatePerson(person.key, {
                              photoUrls: person.photoUrls.filter((u) => u !== url),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {Array.from({ length: person.uploading }).map((_, i) => (
                      <div
                        key={`up-${i}`}
                        className="h-20 w-20 animate-shimmer rounded-xl bg-gradient-to-r from-lavender via-white to-lavender"
                        aria-label="Uploading photo"
                      />
                    ))}
                    {person.photoUrls.length + person.uploading < 3 ? (
                      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/20 text-ink-soft transition-colors hover:border-marigold hover:text-ink">
                        <span className="text-xl leading-none">+</span>
                        <span className="text-[10px] font-semibold">Add photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            void addPhotos(person, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {people.length < 4 ? (
              <button
                type="button"
                className="btn btn-ghost self-start text-sm"
                onClick={() => setPeople((prev) => [...prev, newPerson("other")])}
              >
                + Add another person
              </button>
            ) : null}
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <header>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Pick a style
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Every page of your book will be illustrated in the style you choose.
              </p>
            </header>

            {styles === null && !stylesError ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-shimmer rounded-2xl bg-gradient-to-r from-lavender via-white to-lavender"
                  />
                ))}
              </div>
            ) : null}

            {stylesError ? (
              <div className="rounded-2xl bg-peach/60 p-5 text-sm text-ink">
                We couldn&rsquo;t load the illustration styles right now. Please refresh the
                page to try again.
              </div>
            ) : null}

            {styles ? (
              <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Illustration style">
                {styles.map((style) => {
                  const selected = styleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setStyleId(style.id)}
                      className={`overflow-hidden rounded-2xl border-2 bg-white text-left transition-all ${
                        selected
                          ? "border-coral shadow-fuzzy"
                          : "border-ink/10 hover:border-marigold"
                      }`}
                    >
                      <div className="aspect-[2/1] w-full overflow-hidden bg-lavender">
                        {style.previewImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={style.previewImageUrl}
                            alt={`${style.name} example`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ArtPlaceholder label={style.name} />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2 p-4">
                        <div>
                          <p className="font-display font-bold text-ink">{style.name}</p>
                          {style.description ? (
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                              {style.description}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            selected ? "bg-coral text-cream" : "bg-ink/10 text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-5">
            <header>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Where should the magic arrive?
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                We&rsquo;ll email you as soon as your free preview is ready — usually within a
                few minutes.
              </p>
            </header>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-ink">
                Your email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <p className="rounded-2xl bg-lavender/60 p-4 text-xs leading-relaxed text-ink-soft">
              By continuing you agree that we may use the story and photos you provided to
              create your book preview. We only use your email for your preview link and order
              updates — no newsletters, no sharing with anyone else.
            </p>
          </section>
        )}

        {error ? (
          <p className="mt-5 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral-deep" role="alert">
            {error}
          </p>
        ) : null}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => goTo(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-marigold"
              disabled={!canContinue}
              onClick={() => goTo(step + 1)}
            >
              {step === 1 && uploadsInFlight ? "Uploading photos…" : "Continue"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-coral"
              disabled={!canContinue || submitting}
              onClick={() => void submit()}
            >
              {submitting ? "Creating your preview…" : "Create my free preview"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
