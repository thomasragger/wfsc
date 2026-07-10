"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtPlaceholder, Sparkle } from "@/components/decor";
import { Alert } from "@/components/ui/alert";
import { BookTileVisual } from "@/components/ui/book-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { Chip, PillLabel } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { IconArrowRight } from "@/components/ui/icons";
import { Field, Select, TextArea, TextInput } from "@/components/ui/input";
import { PageTransition, StepTransition } from "@/components/ui/page-transition";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";
import { StepProgress } from "@/components/ui/steps";
import { Turnstile } from "@/components/ui/turnstile";
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

// One focused decision per screen (Typeform/Duolingo-style). The template
// hero is a pre-step; these four are the stepper.
const STEPS = ["Style", "Your story", "The cast", "Finish"] as const;

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

function ageBandLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  return `Ages ${min ?? 0}–${max ?? 8}`;
}

/* ----------------------------------------------------------- draft persistence */
// The wizard is long and photo-heavy, so we snapshot progress to localStorage
// and offer to resume it on the next visit. Uploaded photos already persist
// server-side (their URLs are what we store here). Draft is keyed per entry
// point (template / category / own-memory) so different starts don't collide.

const DRAFT_VERSION = 2 as const;
const DRAFT_PREFIX = "wfsc:wizard-draft";

interface WizardDraft {
  v: typeof DRAFT_VERSION;
  step: number;
  started: boolean;
  memoryText: string;
  title: string;
  greeting: string;
  greetingFrom: string;
  targetAge: number | null;
  styleId: string | null;
  email: string;
  people: { key: string; name: string; role: PersonRole; photoUrls: string[] }[];
}

function draftKey(templateId: string | null, categoryId: string | null): string {
  if (templateId) return `${DRAFT_PREFIX}:t:${templateId}`;
  if (categoryId) return `${DRAFT_PREFIX}:c:${categoryId}`;
  return `${DRAFT_PREFIX}:own`;
}

/** Parse a stored draft, tolerating any schema drift by returning null. */
function readDraft(key: string): WizardDraft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null; // storage disabled / private mode
  }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as unknown;
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    if (o.v !== DRAFT_VERSION) return null;
    const people = Array.isArray(o.people)
      ? (o.people as unknown[]).flatMap((p) => {
          if (!p || typeof p !== "object") return [];
          const pr = p as Record<string, unknown>;
          const photoUrls = Array.isArray(pr.photoUrls)
            ? (pr.photoUrls as unknown[]).filter((u): u is string => typeof u === "string")
            : [];
          return [
            {
              key: typeof pr.key === "string" ? pr.key : crypto.randomUUID(),
              name: typeof pr.name === "string" ? pr.name : "",
              role: (typeof pr.role === "string" ? pr.role : "child") as PersonRole,
              photoUrls,
            },
          ];
        })
      : [];
    return {
      v: DRAFT_VERSION,
      step: typeof o.step === "number" ? o.step : 0,
      started: o.started === true,
      memoryText: typeof o.memoryText === "string" ? o.memoryText : "",
      title: typeof o.title === "string" ? o.title : "",
      greeting: typeof o.greeting === "string" ? o.greeting : "",
      greetingFrom: typeof o.greetingFrom === "string" ? o.greetingFrom : "",
      targetAge: typeof o.targetAge === "number" ? o.targetAge : null,
      styleId: typeof o.styleId === "string" ? o.styleId : null,
      email: typeof o.email === "string" ? o.email : "",
      people,
    };
  } catch {
    return null;
  }
}

/** Whether a draft holds enough real input to be worth resuming. */
function draftIsResumable(d: WizardDraft): boolean {
  return (
    d.step > 0 ||
    d.memoryText.trim().length > 0 ||
    d.title.trim().length > 0 ||
    d.greeting.trim().length > 0 ||
    d.email.trim().length > 0 ||
    d.people.some((p) => p.name.trim().length > 0 || p.photoUrls.length > 0)
  );
}

export function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const categoryId = searchParams.get("category");

  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false); // dismisses the template hero
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [memoryText, setMemoryText] = useState("");
  const [title, setTitle] = useState("");
  const [greeting, setGreeting] = useState("");
  const [greetingFrom, setGreetingFrom] = useState("");
  const [targetAge, setTargetAge] = useState<number | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [templateFailed, setTemplateFailed] = useState(false);
  const [people, setPeople] = useState<PersonDraft[]>([newPerson()]);
  const [styles, setStyles] = useState<StyleSummary[] | null>(null);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Cloudflare Turnstile token (O5). Empty in dev (no site key): see below.
  const [turnstileToken, setTurnstileToken] = useState("");

  // Draft persistence: a snapshot detected on load waits for the user to
  // resume or discard; saving is gated until that choice is made so we never
  // clobber a stored draft before offering it.
  const [pendingDraft, setPendingDraft] = useState<WizardDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  // ?category= — offer that category's templates as pickable cards first.
  const [category, setCategory] = useState<CategorySummary | null>(null);
  const [categoryTemplates, setCategoryTemplates] = useState<TemplateSummary[] | null>(null);
  const [pickerDismissed, setPickerDismissed] = useState(false);

  const storageKey = useMemo(() => draftKey(templateId, categoryId), [templateId, categoryId]);

  // Optional template preselect from ?template=
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    getTemplate(templateId)
      .then((tpl) => {
        if (cancelled) return;
        setTemplate(tpl);
        if (tpl.suggestedStyleId) setStyleId((current) => current ?? tpl.suggestedStyleId);
      })
      .catch(() => {
        if (!cancelled) setTemplateFailed(true); // fall back to own-memory flow
      });
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
      .catch(() => setPickerDismissed(true));
    return () => {
      cancelled = true;
    };
  }, [categoryId, templateId]);

  useEffect(() => {
    getStyles()
      .then(setStyles)
      .catch((err: Error) => setStylesError(err.message));
  }, []);

  // On load (per entry point): surface a resumable draft, otherwise unlock saving.
  useEffect(() => {
    const draft = readDraft(storageKey);
    if (draft && draftIsResumable(draft)) {
      setPendingDraft(draft);
      setDraftHydrated(false);
    } else {
      setPendingDraft(null);
      setDraftHydrated(true);
    }
  }, [storageKey]);

  // Persist progress once the resume choice is settled (never before, so we
  // don't overwrite a stored draft we haven't offered yet).
  useEffect(() => {
    if (!draftHydrated || typeof window === "undefined") return;
    const draft: WizardDraft = {
      v: DRAFT_VERSION,
      step,
      started,
      memoryText,
      title,
      greeting,
      greetingFrom,
      targetAge,
      styleId,
      email,
      people: people.map((p) => ({ key: p.key, name: p.name, role: p.role, photoUrls: p.photoUrls })),
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // storage full / disabled: non-fatal
    }
  }, [
    draftHydrated,
    storageKey,
    step,
    started,
    memoryText,
    title,
    greeting,
    greetingFrom,
    targetAge,
    styleId,
    email,
    people,
  ]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  function resumeDraft() {
    if (!pendingDraft) return;
    const d = pendingDraft;
    setStep(d.step);
    setStarted(d.started);
    setMemoryText(d.memoryText);
    setTitle(d.title);
    setGreeting(d.greeting);
    setGreetingFrom(d.greetingFrom);
    setTargetAge(d.targetAge);
    if (d.styleId) setStyleId(d.styleId);
    setEmail(d.email);
    if (d.people.length > 0) setPeople(d.people.map((p) => ({ ...p, uploading: 0 })));
    setPickerDismissed(true); // resume goes straight into the stepper, not the picker
    setPendingDraft(null);
    setDraftHydrated(true);
  }

  function discardDraft() {
    clearDraft();
    setPendingDraft(null);
    setDraftHydrated(true);
  }

  function pickTemplate(tpl: TemplateSummary) {
    setTemplate(tpl);
    if (tpl.suggestedStyleId) setStyleId((current) => current ?? tpl.suggestedStyleId);
    router.replace(`/create?template=${encodeURIComponent(tpl.id)}`, { scroll: false });
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function startFromOwnMemory() {
    setTemplate(null);
    setTemplateFailed(true);
    setStarted(true);
    router.replace("/create", { scroll: false });
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const uploadsInFlight = people.some((p) => p.uploading > 0);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return styleId !== null;
      case 1:
        return memoryText.trim().length >= 20;
      case 2:
        return (
          people.length >= 1 &&
          people.every((p) => p.name.trim().length > 0 && p.photoUrls.length >= 1) &&
          !uploadsInFlight
        );
      case 3:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      default:
        return false;
    }
  }, [step, styleId, memoryText, people, uploadsInFlight, email]);

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
        greeting: greeting.trim() || undefined,
        greetingFrom: greetingFrom.trim() || undefined,
        templateId: template?.id,
        styleId,
        email: email.trim(),
        targetAge: targetAge ?? undefined,
        people: people.map((p) => ({ name: p.name.trim(), role: p.role, photoUrls: p.photoUrls })),
        turnstileToken: turnstileToken || undefined,
      });
      clearDraft(); // book created: drop the local draft so it doesn't resurface
      router.push(`/book/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
      setSubmitting(false);
    }
  }

  const selectedStyle = styles?.find((s) => s.id === styleId) ?? null;

  // Only block submit on a token when Turnstile is actually configured. In dev
  // the widget calls onVerify("") immediately and the server skips verification.
  const turnstileRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  // ---------------------------------------------------------------- resume draft
  if (pendingDraft && !draftHydrated) {
    return (
      <PageTransition>
        <div ref={topRef} className="mx-auto max-w-md scroll-mt-24 text-center">
          <Card className="p-8">
            <Eyebrow className="mx-auto">Welcome back</Eyebrow>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Continue where you left off?
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              We saved your progress on this book. Pick up right where you stopped, or start fresh.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <Button size="lg" className="w-full" onClick={resumeDraft}>
                Continue my book
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={discardDraft}>
                Start fresh
              </Button>
            </div>
          </Card>
        </div>
      </PageTransition>
    );
  }

  // ---------------------------------------------------------------- category picker
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
            <SkeletonGrid count={2} className="mt-10 grid gap-5 sm:grid-cols-2" itemClassName="h-64 rounded-3xl" />
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categoryTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => pickTemplate(tpl)}
                  className="tile-lift group flex flex-col rounded-3xl text-left"
                >
                  <BookTileVisual
                    image={tpl.mockupImageUrl ?? tpl.previewImageUrl ?? tpl.exampleImageUrl ?? null}
                    alt={tpl.title}
                    aspectClassName="aspect-square"
                  />
                  <div className="flex flex-1 flex-col px-2 pb-1 pt-4">
                    <p className="font-display text-lg font-extrabold leading-snug text-ink group-hover:text-coral">
                      {tpl.title}
                    </p>
                    {tpl.tagline ? <p className="mt-1 text-sm text-ink-soft">{tpl.tagline}</p> : null}
                    <span className="mt-4 inline-flex items-center gap-1.5 font-display text-sm font-bold text-coral">
                      Start from this story <IconArrowRight />
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

  // ---------------------------------------------------------------- template hero
  // While a ?template= is still loading, hold on a soft skeleton so the stepper
  // doesn't flash before the hero.
  if (templateId && !template && !templateFailed) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-[26rem] w-full" rounded="rounded-[2.5rem]" />
        </div>
      </PageTransition>
    );
  }

  if (template && !started) {
    return (
      <PageTransition>
        <div ref={topRef} className="scroll-mt-24">
          <TemplateHero
            template={template}
            style={styles?.find((s) => s.id === (styleId ?? template.suggestedStyleId)) ?? null}
            onStart={() => {
              setStarted(true);
              topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
            onOwnMemory={startFromOwnMemory}
          />
        </div>
      </PageTransition>
    );
  }

  // ---------------------------------------------------------------- stepper
  return (
    <PageTransition>
      <div ref={topRef} className="scroll-mt-24">
        <StepProgress steps={STEPS} current={step} className="mb-8" />

        <Card className="overflow-hidden p-6 sm:p-10">
          <StepTransition stepKey={step} direction={direction}>
            {step === 0 && (
              <StyleStep
                styles={styles}
                stylesError={stylesError}
                styleId={styleId}
                onSelect={setStyleId}
                selectedStyle={selectedStyle}
                recommendedId={template?.suggestedStyleId ?? null}
              />
            )}

            {step === 1 && (
              <StoryStep
                template={template}
                memoryText={memoryText}
                onMemoryChange={setMemoryText}
                targetAge={targetAge}
                onAgeChange={setTargetAge}
              />
            )}

            {step === 2 && (
              <CastStep
                people={people}
                onAdd={() => setPeople((prev) => [...prev, newPerson("other")])}
                onRemove={(key) => setPeople((prev) => prev.filter((p) => p.key !== key))}
                onUpdate={updatePerson}
                onAddPhotos={addPhotos}
              />
            )}

            {step === 3 && (
              <>
                <FinishStep
                  template={template}
                  title={title}
                  onTitleChange={setTitle}
                  greeting={greeting}
                  onGreetingChange={setGreeting}
                  greetingFrom={greetingFrom}
                  onGreetingFromChange={setGreetingFrom}
                  email={email}
                  onEmailChange={setEmail}
                />
                {/* Abuse control (O5). No-ops in dev: renders nothing and
                    reports an empty token, which the server accepts. */}
                <div className="mt-5 flex justify-center">
                  <Turnstile onVerify={setTurnstileToken} action="create-book" />
                </div>
              </>
            )}
          </StepTransition>

          {error ? <Alert className="mt-5">{error}</Alert> : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                Back
              </Button>
            ) : template ? (
              <Button variant="ghost" onClick={() => setStarted(false)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button
                variant="secondary"
                disabled={!canContinue}
                pending={step === 2 && uploadsInFlight}
                pendingLabel="Uploading photos…"
                onClick={() => goTo(step + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                disabled={!canContinue || (turnstileRequired && !turnstileToken)}
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

/* ------------------------------------------------------------------ template hero */

function TemplateHero({
  template,
  style,
  onStart,
  onOwnMemory,
}: {
  template: TemplateSummary;
  style: StyleSummary | null;
  onStart: () => void;
  onOwnMemory: () => void;
}) {
  const beats = template.storyBeats.slice(0, 6);
  const ages = ageBandLabel(template.ageMin, template.ageMax);
  return (
    <section aria-label={`Story idea: ${template.title}`} className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
      {/* The book, shown as the real object */}
      <div className="mx-auto w-full max-w-xs lg:sticky lg:top-24">
        <BookTileVisual
          image={template.mockupImageUrl ?? template.previewImageUrl ?? template.exampleImageUrl ?? null}
          alt={template.title}
          aspectClassName="aspect-square"
          className="shadow-polaroid"
          priority
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {template.categoryName ? <PillLabel className="!text-xs">{template.categoryName}</PillLabel> : null}
          {ages ? (
            <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-white">
              {ages}
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <Eyebrow>Start from this story</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          {template.title}
        </h1>
        {template.tagline ? (
          <p className="mt-2 font-display text-lg font-semibold text-coral">{template.tagline}</p>
        ) : null}
        {template.description ? (
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{template.description}</p>
        ) : null}

        {style ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-white">
            <Sparkle size={12} className="text-marigold" />
            Illustrated in the {style.name} style · change it anytime
          </div>
        ) : null}

        <div className="mt-7 flex max-w-xs flex-col gap-3">
          <Button size="lg" className="w-full whitespace-nowrap" onClick={onStart}>
            Make this book
          </Button>
          <Button variant="ghost" size="lg" className="w-full whitespace-nowrap" onClick={onOwnMemory}>
            Use my own memory
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Free preview first — you only pay once you love it.
        </p>

        {beats.length > 0 ? (
          <div className="mt-9">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide text-ink/70">
              How the story goes
            </p>
            <ol className="mt-3 flex flex-col gap-2.5">
              {beats.map((beat, i) => (
                <li key={beat} className="flex items-start gap-3">
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

/* ------------------------------------------------------------------ style step */

function StyleStep({
  styles,
  stylesError,
  styleId,
  onSelect,
  recommendedId,
}: {
  styles: StyleSummary[] | null;
  stylesError: string | null;
  styleId: string | null;
  onSelect: (id: string) => void;
  selectedStyle: StyleSummary | null;
  recommendedId: string | null;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Choose your look</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every page will be illustrated in the style you pick — hover to see it in action. You can
          change it later.
        </p>
      </header>

      {styles === null && !stylesError ? (
        <SkeletonGrid count={3} className="grid gap-4 sm:grid-cols-3" itemClassName="h-52" />
      ) : null}

      {stylesError ? (
        <Alert>We couldn&rsquo;t load the illustration styles right now. Please refresh to try again.</Alert>
      ) : null}

      {styles ? (
        <div role="radiogroup" aria-label="Illustration style">
          <Carousel ariaLabel="Illustration style" itemGap="gap-4">
            {styles.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={styleId === style.id}
                recommended={recommendedId === style.id}
                onSelect={() => onSelect(style.id)}
              />
            ))}
          </Carousel>
        </div>
      ) : null}
    </section>
  );
}

function StyleCard({
  style,
  selected,
  recommended,
  onSelect,
}: {
  style: StyleSummary;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const peeks = style.referenceImageUrls.slice(0, 3);
  const [hovered, setHovered] = useState(false);
  const [idx, setIdx] = useState(0);

  // On hover, gently cross-fade through the reference images (JS-driven so the
  // fades overlap smoothly — no keyframe gaps/wrap jumps).
  useEffect(() => {
    if (!hovered || peeks.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % peeks.length), 1600);
    return () => clearInterval(t);
  }, [hovered, peeks.length]);

  const leave = () => {
    setHovered(false);
    setIdx(0);
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={leave}
      onFocus={() => setHovered(true)}
      onBlur={leave}
      className={`tile-lift group relative w-56 shrink-0 overflow-hidden rounded-2xl border-2 bg-white text-left ${
        selected ? "border-coral" : "border-transparent hover:border-marigold"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-lavender">
        {style.previewImageUrl ? (
          <ProgressiveImage
            src={style.previewImageUrl}
            alt={`${style.name} example`}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        ) : (
          <ArtPlaceholder label={style.name} />
        )}
        {/* Reference images cross-fade over the preview while hovered. */}
        {peeks.map((url, i) => (
          <div
            key={url}
            className="absolute inset-0 transition-opacity duration-[900ms] ease-in-out"
            style={{ opacity: hovered && idx === i ? 1 : 0 }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {recommended ? (
        <span className="absolute left-3 top-3 rounded-full bg-marigold px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-sm">
          Recommended
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-2 p-4">
        <div>
          <p className="font-display font-bold text-ink">{style.name}</p>
          {style.description ? (
            <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-ink-soft">{style.description}</p>
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
}

/* ------------------------------------------------------------------ story step */

function StoryStep({
  template,
  memoryText,
  onMemoryChange,
  targetAge,
  onAgeChange,
}: {
  template: TemplateSummary | null;
  memoryText: string;
  onMemoryChange: (v: string) => void;
  targetAge: number | null;
  onAgeChange: (v: number | null) => void;
}) {
  const beats = template ? template.storyBeats.slice(0, 10) : [];
  const hasBeats = beats.length > 0;
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {template ? "Make it yours" : "Tell us your story"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {template
            ? "Here's the shape of the story — add your real details and we'll weave them in."
            : "Write it like you'd tell it at bedtime — the little details are what make the magic."}
        </p>
      </header>

      <div className={hasBeats ? "grid gap-6 lg:grid-cols-2 lg:items-start" : ""}>
        {/* Left: the memory input + age — always up top. */}
        <div className="flex flex-col gap-5">
          <Field
            label={template ? "Your real memory" : "Your memory"}
            htmlFor="memory"
            hint={
              template
                ? "Names, places, the thing that made everyone laugh — the more real, the better."
                : `Need a nudge? “${MEMORY_PROMPTS[1]}”`
            }
          >
            <TextArea
              id="memory"
              className="min-h-44 leading-relaxed"
              placeholder={template ? templatePlaceholder(template) : MEMORY_PROMPTS[0]}
              value={memoryText}
              onChange={(e) => onMemoryChange(e.target.value)}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-bold text-ink">
              Who is it for?{" "}
              <span className="font-normal text-ink-soft">(we&rsquo;ll tune the words to their age)</span>
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reader age">
              {AGE_BANDS.map((band) => (
                <Chip
                  key={band.value}
                  role="radio"
                  selected={targetAge === band.value}
                  onClick={() => onAgeChange(targetAge === band.value ? null : band.value)}
                >
                  {band.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Right: the story shape (template only). */}
        {hasBeats ? (
          <div className="rounded-2xl bg-gradient-to-br from-lavender/60 via-cream to-peach/50 p-5">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink/70">
              The journey your book will take
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {beats.map((beat, i) => (
                <li key={beat} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white font-display text-[10px] font-extrabold text-coral shadow-sm"
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

/* ------------------------------------------------------------------ cast step */

function CastStep({
  people,
  onAdd,
  onRemove,
  onUpdate,
  onAddPhotos,
}: {
  people: PersonDraft[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<PersonDraft>) => void;
  onAddPhotos: (person: PersonDraft, files: FileList | null) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Who&rsquo;s in it?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Add up to four people, with 1&ndash;3 photos each. Clear, well-lit photos of their face work best.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {people.map((person, idx) => (
          <div key={person.key} className="rounded-2xl border-2 border-ink/10 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-sm font-bold text-ink-soft">Person {idx + 1}</p>
              {people.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-coral hover:underline"
                  onClick={() => onRemove(person.key)}
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
                  onChange={(e) => onUpdate(person.key, { name: e.target.value })}
                />
              </Field>
              <Field label="Role in the story" htmlFor={`role-${person.key}`}>
                <Select
                  id={`role-${person.key}`}
                  value={person.role}
                  onChange={(e) => onUpdate(person.key, { role: e.target.value as PersonRole })}
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
                      onUpdate(person.key, { photoUrls: person.photoUrls.filter((u) => u !== url) })
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
                      onAddPhotos(person, e.target.files);
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
        <Button variant="ghost" size="sm" className="self-start" onClick={onAdd}>
          + Add another person
        </Button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ finish step */

function FinishStep({
  template,
  title,
  onTitleChange,
  greeting,
  onGreetingChange,
  greetingFrom,
  onGreetingFromChange,
  email,
  onEmailChange,
}: {
  template: TemplateSummary | null;
  title: string;
  onTitleChange: (v: string) => void;
  greeting: string;
  onGreetingChange: (v: string) => void;
  greetingFrom: string;
  onGreetingFromChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Almost there</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Add the finishing touches, then tell us where to send your free preview — usually ready in a few minutes.
        </p>
      </header>

      <Field label="Book title" htmlFor="title" optional>
        <TextInput
          id="title"
          placeholder={template ? template.title : "We'll suggest one if you leave this empty"}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={120}
        />
      </Field>

      <Field
        label="A personal note"
        htmlFor="greeting"
        optional
        hint="Printed on the dedication page at the front of the book — like a handwritten message inside a gift."
      >
        <TextArea
          id="greeting"
          className="min-h-24 leading-relaxed"
          placeholder="For Mia, who makes every ordinary day an adventure."
          value={greeting}
          onChange={(e) => onGreetingChange(e.target.value)}
          maxLength={600}
        />
      </Field>

      <Field
        label="Signed, from"
        htmlFor="greeting-from"
        optional
        hint="Shown under the note, e.g. “Love, Mum & Dad”."
      >
        <TextInput
          id="greeting-from"
          placeholder="Mum & Dad"
          value={greetingFrom}
          onChange={(e) => onGreetingFromChange(e.target.value)}
          maxLength={80}
        />
      </Field>

      <Field label="Your email" htmlFor="email">
        <TextInput
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="email"
        />
      </Field>

      <p className="rounded-2xl bg-lavender/60 p-4 text-xs leading-relaxed text-ink-soft">
        By continuing you agree that we may use the story and photos you provided to create your book,
        including processing them with trusted third-party AI partners (such as Anthropic and
        Replicate) to write the story and generate the illustrations. Your source photos are deleted
        30 days after your book is delivered, and your memory text is kept only while your book
        exists. We use your email only for your preview link and order updates, never for newsletters
        or sharing. See our{" "}
        <a href="/privacy" className="font-semibold text-ink underline hover:text-coral">
          privacy policy
        </a>
        .
      </p>
    </section>
  );
}
