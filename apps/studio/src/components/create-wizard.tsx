"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtPlaceholder, Doodle, Sparkle } from "@/components/decor";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, PillLabel } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Field, Select, TextArea, TextInput } from "@/components/ui/input";
import { PageTransition, StepTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";
import { StepProgress } from "@/components/ui/steps";
import { PERSON_ROLES, type PersonRole } from "@/lib/book-payload";
import {
  createBook,
  getCategoryTemplates,
  getStyles,
  getTemplate,
  uploadPhoto,
  type CategorySummary,
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

/** "Who is it for?" bands; value is the midpoint sent as targetAge. */
const AGE_BANDS = [
  { label: "0–2 years", value: 1 },
  { label: "3–5 years", value: 4 },
  { label: "6–8 years", value: 7 },
] as const;

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

/** "Our Day at the Zoo" -> "day at the zoo" — for the memory-prompt scaffold. */
function templateNoun(title: string): string {
  return title.replace(/^(our|the|a|an)\s+/i, "").toLowerCase();
}

function templatePlaceholder(tpl: TemplateSummary): string {
  return (
    `Tell us about YOUR ${templateNoun(tpl.title)} — who was there, how the day started, ` +
    `the moment everyone still laughs about, and the little detail you never want to forget…`
  );
}

export function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const categoryId = searchParams.get("category");

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [memoryText, setMemoryText] = useState("");
  const [title, setTitle] = useState("");
  const [targetAge, setTargetAge] = useState<number | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [people, setPeople] = useState<PersonDraft[]>([newPerson()]);
  const [styles, setStyles] = useState<StyleSummary[] | null>(null);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // ?category= — offer that category's templates as pickable cards first.
  const [category, setCategory] = useState<CategorySummary | null>(null);
  const [categoryTemplates, setCategoryTemplates] = useState<TemplateSummary[] | null>(null);
  const [pickerDismissed, setPickerDismissed] = useState(false);

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

  // Load the category's templates for the picker (skipped once a template is set).
  useEffect(() => {
    if (!categoryId || templateId) return;
    let cancelled = false;
    getCategoryTemplates(categoryId)
      .then(({ category: cat, templates }) => {
        if (cancelled) return;
        setCategory(cat);
        setCategoryTemplates(templates);
      })
      .catch(() => setPickerDismissed(true)); // unknown category -> plain wizard
    return () => {
      cancelled = true;
    };
  }, [categoryId, templateId]);

  function pickTemplate(tpl: TemplateSummary) {
    setTemplate(tpl);
    if (tpl.suggestedStyleId) {
      setStyleId((current) => current ?? tpl.suggestedStyleId);
    }
    router.replace(`/create?template=${encodeURIComponent(tpl.id)}`, { scroll: false });
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

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
    setDirection(next > step ? "forward" : "back");
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
        targetAge: targetAge ?? undefined,
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

  // ?category= entry: let the customer pick a story idea before the wizard.
  const showPicker = !!categoryId && !templateId && !template && !pickerDismissed;

  if (showPicker) {
    return (
      <PageTransition>
        <div ref={topRef} className="scroll-mt-24">
          <header className="text-center">
            <Eyebrow className="mx-auto">
              {category ? `Stories for ${category.name}` : "Pick a story idea"}
            </Eyebrow>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {category ? `A story they'll ask for every night.` : `Start from a story idea`}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              {category?.tagline ?? "Pick an idea to begin, then make it entirely yours."}
            </p>
          </header>

          {categoryTemplates === null ? (
            <SkeletonGrid
              count={2}
              className="mt-10 grid gap-5 sm:grid-cols-2"
              itemClassName="h-64 rounded-3xl"
            />
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {categoryTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => pickTemplate(tpl)}
                  className="tile-lift group flex flex-col rounded-3xl bg-white/75 p-4 text-left shadow-fuzzy ring-1 ring-white"
                >
                  <div className="scallop aspect-[5/4] overflow-hidden bg-lavender">
                    {(tpl.previewImageUrl ?? tpl.exampleImageUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tpl.previewImageUrl ?? tpl.exampleImageUrl ?? undefined}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <ArtPlaceholder />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
                    <p className="font-display text-lg font-extrabold leading-snug text-ink group-hover:text-coral">
                      {tpl.title}
                    </p>
                    {tpl.tagline ? (
                      <p className="mt-1 text-sm text-ink-soft">{tpl.tagline}</p>
                    ) : null}
                    <span className="mt-4 inline-flex items-center gap-1.5 font-display text-sm font-bold text-coral">
                      Start from this story <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button variant="ghost" onClick={() => setPickerDismissed(true)}>
              Start from your own memory instead
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div ref={topRef} className="scroll-mt-24">
        {template && step === 0 ? <TemplateIntroCard template={template} /> : null}

        <StepProgress steps={STEPS} current={step} className="mb-8" />

        <Card className="overflow-hidden p-6 sm:p-10">
          <StepTransition stepKey={step} direction={direction}>
            {step === 0 && (
              <section className="flex flex-col gap-5">
                <header>
                  <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                    Tell us your story
                  </h1>
                  <p className="mt-1 text-sm text-ink-soft">
                    Write it like you&rsquo;d tell it at bedtime — the little details are what
                    make the magic.
                  </p>
                </header>

                <Field
                  label="Your memory"
                  htmlFor="memory"
                  hint={
                    template
                      ? "Your real details make the story yours — names, places, the thing that made everyone laugh."
                      : `Need a nudge? “${MEMORY_PROMPTS[1]}”`
                  }
                >
                  <TextArea
                    id="memory"
                    className="min-h-44 leading-relaxed"
                    placeholder={template ? templatePlaceholder(template) : MEMORY_PROMPTS[0]}
                    value={memoryText}
                    onChange={(e) => setMemoryText(e.target.value)}
                  />
                </Field>

                <div>
                  <p className="mb-1.5 text-sm font-bold text-ink">
                    Who is it for?{" "}
                    <span className="font-normal text-ink-soft">
                      (we&rsquo;ll tune the words to their age)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reader age">
                    {AGE_BANDS.map((band) => (
                      <Chip
                        key={band.value}
                        role="radio"
                        selected={targetAge === band.value}
                        onClick={() =>
                          setTargetAge((current) => (current === band.value ? null : band.value))
                        }
                      >
                        {band.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <Field label="Book title" htmlFor="title" optional>
                  <TextInput
                    id="title"
                    placeholder="We'll suggest one if you leave this empty"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                  />
                </Field>
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
                        <Field label="Name" htmlFor={`name-${person.key}`}>
                          <TextInput
                            id={`name-${person.key}`}
                            placeholder="Mia"
                            value={person.name}
                            maxLength={80}
                            onChange={(e) => updatePerson(person.key, { name: e.target.value })}
                          />
                        </Field>
                        <Field label="Role in the story" htmlFor={`role-${person.key}`}>
                          <Select
                            id={`role-${person.key}`}
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
                          </Select>
                        </Field>
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
                          <Skeleton key={`up-${i}`} className="h-20 w-20" rounded="rounded-xl" />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setPeople((prev) => [...prev, newPerson("other")])}
                  >
                    + Add another person
                  </Button>
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
                  <SkeletonGrid
                    count={4}
                    className="grid gap-4 sm:grid-cols-2"
                    itemClassName="h-64"
                  />
                ) : null}

                {stylesError ? (
                  <Alert>
                    We couldn&rsquo;t load the illustration styles right now. Please refresh
                    the page to try again.
                  </Alert>
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
                          <div className="aspect-[4/3] w-full overflow-hidden bg-lavender">
                            {style.previewImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={style.previewImageUrl}
                                alt={`${style.name} example`}
                                className="h-full w-full object-cover"
                                loading="lazy"
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
                                selected ? "bg-coral text-white" : "bg-ink/10 text-transparent"
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
                    We&rsquo;ll email you as soon as your free preview is ready — usually within
                    a few minutes.
                  </p>
                </header>

                <Field label="Your email" htmlFor="email">
                  <TextInput
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>

                <p className="rounded-2xl bg-lavender/60 p-4 text-xs leading-relaxed text-ink-soft">
                  By continuing you agree that we may use the story and photos you provided to
                  create your book preview. We only use your email for your preview link and
                  order updates — no newsletters, no sharing with anyone else.
                </p>
              </section>
            )}
          </StepTransition>

          {error ? <Alert className="mt-5">{error}</Alert> : null}

          {/* Nav */}
          <div className="mt-8 flex items-center justify-between gap-3" id="wizard-nav">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button
                variant="secondary"
                disabled={!canContinue}
                pending={step === 1 && uploadsInFlight}
                pendingLabel="Uploading photos…"
                onClick={() => goTo(step + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                disabled={!canContinue}
                pending={submitting}
                pendingLabel="Creating your preview…"
                onClick={() => void submit()}
              >
                Create my free preview
              </Button>
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}

/**
 * The template intro card shown above the wizard when starting from a
 * story idea — title, tagline, category chip, and the beats of the
 * journey the finished book will follow.
 */
function TemplateIntroCard({ template }: { template: TemplateSummary }) {
  const beats = template.storyBeats.slice(0, 10);
  return (
    <section
      aria-label={`Story idea: ${template.title}`}
      className="relative mb-8 overflow-hidden rounded-[2rem] shadow-fuzzy ring-1 ring-white"
      style={{
        background:
          "linear-gradient(126deg, #ece5f8 0%, #fdf6ec 45%, #fbe3cb 80%, #f9d3ab 100%)",
      }}
    >
      <Doodle src="sun.png" size={44} className="animate-drift absolute right-5 top-5 opacity-90" />
      <Doodle src="heart-small.png" size={22} className="animate-twinkle absolute bottom-6 right-[22%]" />
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <PillLabel className="!text-xs">{template.categoryName ?? "Story idea"}</PillLabel>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1.5 font-display text-xs font-bold text-ink-soft">
            <Sparkle size={11} className="text-marigold" />
            Illustration style pre-picked — change it anytime
          </span>
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
          {template.title}
        </h2>
        {template.tagline ? (
          <p className="mt-1 font-display text-base font-semibold text-coral">
            {template.tagline}
          </p>
        ) : null}
        {template.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {template.description}
          </p>
        ) : null}

        {beats.length > 0 ? (
          <div className="mt-6">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide text-ink/70">
              The journey your book will take
            </p>
            <ol className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {beats.map((beat, i) => (
                <li key={beat} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-display text-[11px] font-extrabold text-coral shadow-sm"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink">{beat}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
