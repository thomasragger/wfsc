"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FONT_PAIRINGS, SCRIPT_FONT, fontStylesheetUrl } from "@wfsc/book-engine";

import { Link, useRouter } from "@/i18n/navigation";
import { ArtPlaceholder, Sparkle } from "@/components/decor";
import { Alert } from "@/components/ui/alert";
import { BookTileVisual } from "@/components/ui/book-tile";
import { ProductCard } from "@/components/ui/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { Chip, PillLabel } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Field, Select, TextArea, TextInput } from "@/components/ui/input";
import { PageTransition, StepTransition } from "@/components/ui/page-transition";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";
import { StepProgress } from "@/components/ui/steps";
import { BottomBar } from "@/components/ui/bottom-bar";
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
// hero is a pre-step; these four are the stepper. STEPS drives internal logic
// and stable (locale-independent) analytics step names; the displayed labels
// come from the "steps" translation array.
const STEPS = ["Style", "Your story", "The cast", "Finish"] as const;

/** "Who is it for?" bands; value is the midpoint sent as targetAge. Labels
 * come from the "ageBands" translation array (same order). */
const AGE_BANDS = [{ value: 1 }, { value: 4 }, { value: 7 }] as const;

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

/** "Our Day at the Zoo" -> "day at the zoo" for the memory-prompt scaffold. */
function templateNoun(title: string): string {
  return title.replace(/^(our|the|a|an)\s+/i, "").toLowerCase();
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
  const t = useTranslations("wizard");
  const stepLabels = t.raw("steps") as string[];
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
  const [consent, setConsent] = useState(false);
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

  // PostHog funnel tracking. No-ops when analytics is unconfigured (dev). Never
  // sends PII: only step indices/names and upload success/fail, no photos,
  // names, email or memory text.
  const posthog = usePostHog();
  const track = useCallback(
    (event: string, props?: Record<string, string | number | boolean>) => {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog?.capture(event, props);
    },
    [posthog],
  );

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
  // localStorage is client-only, so this must run post-mount (a lazy initializer
  // would desync server and client HTML); the synchronous setState is intentional.
  useEffect(() => {
    const draft = readDraft(storageKey);
    if (draft && draftIsResumable(draft)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Funnel: fire "step entered" whenever a stepper step first becomes visible.
  // Gated on the stepper actually being on screen (not the picker/hero/loading
  // screens) and deduped so re-renders don't double-count.
  const lastEnteredStep = useRef<number | null>(null);
  useEffect(() => {
    const showPicker = !!categoryId && !templateId && !template && !pickerDismissed;
    const showTemplateLoading = !!templateId && !template && !templateFailed;
    const showHero = !!template && !started;
    const inStepper = !showPicker && !showTemplateLoading && !showHero;
    if (!inStepper) return;
    if (lastEnteredStep.current === step) return;
    lastEnteredStep.current = step;
    track("wizard_step_entered", { step, step_name: STEPS[step] });
  }, [
    step,
    started,
    template,
    templateFailed,
    pickerDismissed,
    categoryId,
    templateId,
    track,
  ]);

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
        return consent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      default:
        return false;
    }
  }, [step, styleId, memoryText, people, uploadsInFlight, email, consent]);

  function goTo(next: number) {
    if (next > step) track("wizard_step_completed", { step, step_name: STEPS[step] });
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
        track("photo_upload_succeeded");
      } catch (err) {
        setPeople((prev) =>
          prev.map((p) => (p.key === person.key ? { ...p, uploading: p.uploading - 1 } : p)),
        );
        setError(err instanceof Error ? err.message : t("errorUploadFailed"));
        track("photo_upload_failed");
      }
    }
  }

  async function submit() {
    if (!styleId || submitting) return;
    setSubmitting(true);
    setError(null);
    track("wizard_step_completed", {
      step: STEPS.length - 1,
      step_name: STEPS[STEPS.length - 1],
    });
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
      setError(err instanceof Error ? err.message : t("errorGeneric"));
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
            <Eyebrow className="mx-auto">{t("resumeEyebrow")}</Eyebrow>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {t("resumeTitle")}
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              {t("resumeBody")}
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <Button size="lg" className="w-full" onClick={resumeDraft}>
                {t("resumeContinue")}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={discardDraft}>
                {t("resumeStartFresh")}
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
              {category ? t("pickerEyebrowCategory", { name: category.name }) : t("pickerEyebrowDefault")}
            </Eyebrow>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {category ? t("pickerTitleCategory") : t("pickerTitleDefault")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              {category?.tagline ?? t("pickerTaglineFallback")}
            </p>
          </header>

          {categoryTemplates === null ? (
            <SkeletonGrid count={2} className="mt-10 grid gap-5 sm:grid-cols-2" itemClassName="h-64 rounded-3xl" />
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {categoryTemplates.map((tpl) => (
                <ProductCard
                  key={tpl.id}
                  onClick={() => pickTemplate(tpl)}
                  image={tpl.mockupImageUrl ?? tpl.previewImageUrl ?? tpl.exampleImageUrl ?? null}
                  hoverImage={tpl.mockupImageUrl ? tpl.previewImageUrl : null}
                  title={tpl.title}
                  subtitle={tpl.tagline}
                  ctaLabel={t("pickerCardCta")}
                />
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Button variant="ghost" onClick={() => setPickerDismissed(true)}>
              {t("pickerOwnMemory")}
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
  // The back action is shared by the rail (lg+) and the inline mobile nav
  // (<lg): step 0 with a template goes back to the hero, otherwise to the
  // previous step. Rendered fresh in each place so both stay in sync.
  const backButton = (variant: "ghost", className: string) =>
    step > 0 ? (
      <Button variant={variant} className={className} onClick={() => goTo(step - 1)}>
        {t("back")}
      </Button>
    ) : template ? (
      <Button variant={variant} className={className} onClick={() => setStarted(false)}>
        {t("back")}
      </Button>
    ) : null;

  const forwardButton = (className: string) =>
    step < STEPS.length - 1 ? (
      <Button
        variant="secondary"
        className={className}
        disabled={!canContinue}
        pending={step === 2 && uploadsInFlight}
        pendingLabel={t("uploadingPhotos")}
        onClick={() => goTo(step + 1)}
      >
        {t("continue")}
      </Button>
    ) : (
      <Button
        className={className}
        disabled={!canContinue || (turnstileRequired && !turnstileToken)}
        pending={submitting}
        pendingLabel={t("creatingPreview")}
        onClick={() => void submit()}
      >
        {t("createPreview")}
      </Button>
    );

  return (
    <PageTransition>
      <div ref={topRef} className="scroll-mt-24 pb-4">
        {/* Horizontal progress only on <lg; the rail carries it on lg+. */}
        <StepProgress steps={stepLabels} current={step} className="mb-6 lg:hidden" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          {/* main step column */}
          <div className="min-w-0">
            <Card className="overflow-hidden p-5 sm:p-7">
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
                      consent={consent}
                      onConsentChange={setConsent}
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
            </Card>
          </div>

          {/* Right rail (lg+ only): step list + actions + trust note, then the
              evolving "book so far" preview. On <lg the inline nav under the
              step card carries the actions instead. `lg:self-stretch` makes the
              aside fill the full grid-row height so the inner sticky div has
              room to travel (grid `lg:items-start` would otherwise shrink it to
              content height and sticky would never engage). */}
          <aside className="hidden lg:block lg:self-stretch">
            <div className="lg:sticky lg:top-24">
              <Card className="p-5">
                <ol className="flex flex-col gap-1" aria-label={stepLabels.join(", ")}>
                  {stepLabels.map((label, i) => {
                    const done = i < step;
                    const active = i === step;
                    return (
                      <li
                        key={label}
                        className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                          active ? "bg-coral/5" : ""
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                            active
                              ? "bg-coral text-white"
                              : done
                                ? "bg-sage text-cream"
                                : "bg-white text-ink-soft ring-2 ring-ink/10"
                          }`}
                          aria-current={active ? "step" : undefined}
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span
                          className={`text-sm font-semibold ${active ? "text-ink" : "text-ink-soft"}`}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 flex flex-col gap-2.5">
                  {forwardButton("w-full")}
                  {backButton("ghost", "w-full")}
                </div>

                <p className="mt-4 text-center text-xs text-ink-soft">{t("heroFreePreview")}</p>
              </Card>

              {/* The book, growing with every choice, right below the rail. */}
              <BookSoFar
                layout="rail"
                selectedStyle={selectedStyle}
                template={template}
                memoryText={memoryText}
                people={people}
                title={title}
                greeting={greeting}
                greetingFrom={greetingFrom}
              />
            </div>
          </aside>
        </div>

        {/* The evolving book on <lg: a compact horizontal strip above the inline
            nav (front matter lives in the Finish step's own previews there). */}
        <div className="mt-6 lg:hidden">
          <BookSoFar
            layout="strip"
            selectedStyle={selectedStyle}
            template={template}
            memoryText={memoryText}
            people={people}
            title={title}
            greeting={greeting}
            greetingFrom={greetingFrom}
          />
        </div>

        {/* Step navigation on <lg: inline under the step card (the rail carries
            the actions on lg+). */}
        <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
          {backButton("ghost", "") ?? <span />}
          {forwardButton("")}
        </div>
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
  const t = useTranslations("wizard");
  const beats = template.storyBeats.slice(0, 6);
  const ages =
    template.ageMin == null && template.ageMax == null
      ? null
      : t("agesRange", { min: template.ageMin ?? 0, max: template.ageMax ?? 8 });
  return (
    <section
      aria-label={t("heroAriaLabel", { title: template.title })}
      className="grid gap-10 pb-24 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:pb-0"
    >
      {/* The book, shown as the real object */}
      <div className="mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:max-w-none">
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
        <Eyebrow>{t("heroEyebrow")}</Eyebrow>
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
            {t("heroStyleLine", { name: style.name })}
          </div>
        ) : null}

        {/* In-flow CTAs on desktop; on mobile the fixed bottom bar (below)
            keeps the action reachable without scrolling past the beats. */}
        <div className="mt-7 hidden max-w-xs flex-col gap-3 lg:flex">
          <Button size="lg" className="w-full whitespace-nowrap" onClick={onStart}>
            {t("heroMakeThisBook")}
          </Button>
          <Button variant="ghost" size="lg" className="w-full whitespace-nowrap" onClick={onOwnMemory}>
            {t("heroUseOwnMemory")}
          </Button>
        </div>
        <p className="mt-3 hidden text-xs text-ink-soft lg:block">
          {t("heroFreePreview")}
        </p>

        {/* Mobile: pinned bottom action bar (portaled, safe-area aware) */}
        <span className="lg:hidden">
          <BottomBar>
            <div className="mx-auto flex w-full max-w-md items-center gap-2">
              <Button variant="ghost" className="flex-1 whitespace-nowrap" onClick={onOwnMemory}>
                {t("heroUseOwnMemory")}
              </Button>
              <Button className="flex-[1.3] whitespace-nowrap" onClick={onStart}>
                {t("heroMakeThisBook")}
              </Button>
            </div>
          </BottomBar>
        </span>

        {beats.length > 0 ? (
          <div className="mt-9">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide text-ink/70">
              {t("heroHowStoryGoes")}
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
  const t = useTranslations("wizard");
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("styleTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("styleSubtitle")}
        </p>
      </header>

      {styles === null && !stylesError ? (
        <SkeletonGrid count={3} className="grid gap-4 sm:grid-cols-3" itemClassName="h-52" />
      ) : null}

      {stylesError ? (
        <Alert>{t("styleError")}</Alert>
      ) : null}

      {styles ? (
        <div role="radiogroup" aria-label={t("styleRadioLabel")}>
          <Carousel ariaLabel={t("styleRadioLabel")} itemGap="gap-4">
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
  const t = useTranslations("wizard");
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
            alt={t("styleCardAlt", { name: style.name })}
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
          {t("styleRecommended")}
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
  const t = useTranslations("wizard");
  const memoryPrompts = t.raw("memoryPrompts") as string[];
  const ageBandLabels = t.raw("ageBands") as string[];
  const beats = template ? template.storyBeats.slice(0, 10) : [];
  const hasBeats = beats.length > 0;
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
          {template ? t("storyTitleTemplate") : t("storyTitleOwn")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {template ? t("storySubtitleTemplate") : t("storySubtitleOwn")}
        </p>
      </header>

      <div className={hasBeats ? "grid gap-6 lg:grid-cols-2 lg:items-start" : ""}>
        {/* Left: the memory input + age — always up top. The memory field is
            dressed as a page in a diary: a flat paper card with faint ruled
            lines. The step header above is the prompt; still a real <textarea>. */}
        <div className="flex flex-col gap-5">
          <Card className="bg-white p-5 shadow-none ring-1 ring-ink/10 sm:p-6">
            <textarea
              id="memory"
              aria-label={template ? t("memoryLabelTemplate") : t("memoryLabelOwn")}
              className="block min-h-48 w-full resize-y border-transparent bg-transparent p-0 font-body text-[1.05rem] leading-8 text-ink placeholder:text-ink-soft/50 focus:outline-none focus:ring-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), rgb(118 30 11 / 0.1) calc(2rem - 1px), rgb(118 30 11 / 0.1) 2rem)",
                backgroundAttachment: "local",
                lineHeight: "2rem",
              }}
              placeholder={
                template
                  ? t("memoryPlaceholderTemplate", { noun: templateNoun(template.title) })
                  : memoryPrompts[0]
              }
              value={memoryText}
              onChange={(e) => onMemoryChange(e.target.value)}
            />
          </Card>

          <div>
            <p className="mb-1.5 text-sm font-bold text-ink">
              {t("whoFor")}{" "}
              <span className="font-normal text-ink-soft">{t("whoForHint")}</span>
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ageRadioLabel")}>
              {AGE_BANDS.map((band, i) => (
                <Chip
                  key={band.value}
                  role="radio"
                  selected={targetAge === band.value}
                  onClick={() => onAgeChange(targetAge === band.value ? null : band.value)}
                >
                  {ageBandLabels[i]}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Right: the story shape (template only). */}
        {hasBeats ? (
          <div className="rounded-2xl bg-gradient-to-br from-lavender/60 via-cream to-peach/50 p-5">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink/70">
              {t("storyJourney")}
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
  const t = useTranslations("wizard");
  const roleLabels = t.raw("roles") as Record<PersonRole, string>;
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("castTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("castSubtitle")}
        </p>
      </header>

      {/* Character cards: the uploaded photo becomes the character preview;
          the last card adds another person. Three-up on sm+ (add-person card
          in-grid); on <sm three or more people become a swipeable carousel. */}
      <div
        className={
          people.length >= 3
            ? "-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3"
        }
      >
        {people.map((person) => (
          <div
            key={person.key}
            className={`relative flex flex-col rounded-2xl border-2 border-ink/10 bg-white p-2.5 ${
              people.length >= 3 ? "w-56 shrink-0 snap-start sm:w-auto sm:shrink" : ""
            }`}
          >
            {people.length > 1 ? (
              <button
                type="button"
                aria-label={t("castRemove")}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm ring-1 ring-ink/10 transition hover:bg-coral hover:text-white"
                onClick={() => onRemove(person.key)}
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            ) : null}

            <label className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-lavender">
              {person.photoUrls[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={person.photoUrls[0]}
                  alt={t("castPhotoAlt", { name: person.name || t("castPhotoAltFallback") })}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : person.uploading > 0 ? (
                <Skeleton className="h-full w-full" rounded="rounded-none" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1 text-ink-soft transition-colors group-hover:text-ink">
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[10px] font-semibold">{t("castAddPhoto")}</span>
                </span>
              )}
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

            {person.photoUrls.length > 0 || person.uploading > 0 ? (
              <div className="mt-2 flex items-center gap-1.5">
                {person.photoUrls.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-8 w-8 rounded-md object-cover" />
                    <button
                      type="button"
                      aria-label={t("castRemovePhoto")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-ink shadow-sm ring-1 ring-ink/10 transition hover:bg-coral hover:text-white"
                      onClick={() =>
                        onUpdate(person.key, { photoUrls: person.photoUrls.filter((u) => u !== url) })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Array.from({ length: person.uploading }).map((_, i) => (
                  <Skeleton key={`up-${i}`} className="h-8 w-8" rounded="rounded-md" />
                ))}
                {person.photoUrls.length + person.uploading < 3 ? (
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-ink/20 text-xs text-ink-soft hover:border-marigold hover:text-ink">
                    +
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
            ) : null}

            <TextInput
              id={`name-${person.key}`}
              aria-label={t("castName")}
              placeholder={t("castNamePlaceholder")}
              value={person.name}
              maxLength={80}
              className="mt-2 py-2 text-sm"
              onChange={(e) => onUpdate(person.key, { name: e.target.value })}
            />
            <Select
              id={`role-${person.key}`}
              aria-label={t("castRole")}
              value={person.role}
              className="mt-1.5 py-2 text-sm"
              onChange={(e) => onUpdate(person.key, { role: e.target.value as PersonRole })}
            >
              {PERSON_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {people.length < 4 ? (
          <button
            type="button"
            onClick={onAdd}
            className={`flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 text-ink-soft transition-colors hover:border-marigold hover:text-ink ${
              people.length >= 3 ? "w-56 shrink-0 snap-start sm:w-auto sm:shrink" : ""
            }`}
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs font-semibold">{t("castAddPerson")}</span>
          </button>
        ) : null}
      </div>
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
  consent,
  onConsentChange,
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
  consent: boolean;
  onConsentChange: (v: boolean) => void;
}) {
  const t = useTranslations("wizard");
  // Printed-page copy lives in the flipbook namespace; resolved against the
  // current UI locale (matching the person filling in the form).
  const tFlip = useTranslations("flipbook");

  // Front-matter previews reuse the book's own font language. The wizard has no
  // font picker, so we render in the default "storybook" pairing (display face
  // for the title) and the shared script face for the dedication, exactly like
  // the flipbook. Fonts load via the same Google Fonts stylesheet the flipbook uses.
  const titleText = title.trim() || (template ? template.title : t("finishTitlePlaceholder"));

  return (
    <section className="flex flex-col gap-6">
      {/* React hoists this to <head>; loads the pairing + script Google fonts. */}
      <link rel="stylesheet" href={fontStylesheetUrl(FM_PAIRING)} />

      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("finishTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("finishSubtitle")}
        </p>
      </header>

      {/* Live front-matter previews. On lg+ the right-rail "book so far" panel
          carries these and stays in view while you type, so here they show only
          on <lg — side by side, full width, above the inputs. */}
      <div className="lg:hidden">
        <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink/70">
          {t("finishPreviewLabel")}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FinishPreviewPage caption={tFlip("titlePage")}>
            <TitlePageInner title={titleText} imprint={tFlip("imprint")} />
          </FinishPreviewPage>
          <FinishPreviewPage caption={tFlip("dedication")}>
            <DedicationPageInner
              label={tFlip("dedication")}
              greeting={greeting}
              placeholder={tFlip("dedicationPlaceholder")}
              fromText={
                greetingFrom.trim() ? tFlip("dedicationFrom", { name: greetingFrom.trim() }) : null
              }
            />
          </FinishPreviewPage>
        </div>
      </div>

      {/* Front-matter inputs. Comfortable single column; the live preview is the
          rail (lg+) or the strip above (<lg). */}
      <div className="flex flex-col gap-4">
        <Field label={t("finishBookTitle")} htmlFor="title" optional>
          <TextInput
            id="title"
            placeholder={template ? template.title : t("finishTitlePlaceholder")}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={120}
          />
        </Field>

        <Field label={t("finishNote")} htmlFor="greeting" optional hint={t("finishNoteHint")}>
          <TextArea
            id="greeting"
            className="min-h-24 leading-relaxed"
            placeholder={t("finishNotePlaceholder")}
            value={greeting}
            onChange={(e) => onGreetingChange(e.target.value)}
            maxLength={600}
          />
        </Field>

        <Field
          label={t("finishSignedFrom")}
          htmlFor="greeting-from"
          optional
          hint={t("finishSignedFromHint")}
        >
          <TextInput
            id="greeting-from"
            placeholder={t("finishSignedFromPlaceholder")}
            value={greetingFrom}
            onChange={(e) => onGreetingFromChange(e.target.value)}
            maxLength={80}
          />
        </Field>
      </div>

      {/* Delivery + consent, clearly after the front matter. */}
      <div className="grid gap-4 border-t border-ink/10 pt-5 sm:grid-cols-2 sm:items-start">
        <Field label={t("finishEmail")} htmlFor="email">
          <TextInput
            id="email"
            type="email"
            placeholder={t("finishEmailPlaceholder")}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            autoComplete="email"
          />
        </Field>

        {/* Explicit privacy opt-in — gates the submit button. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-lavender/60 p-4 text-xs leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-coral"
          />
          <span>
            {t("finishConsent")}{" "}
            <Link href="/privacy" className="font-semibold text-ink underline hover:text-coral">
              {t("finishConsentLink")}
            </Link>
            .
          </span>
        </label>
      </div>
    </section>
  );
}

/**
 * A single front-matter page preview: cream page with the flipbook's PageFrame
 * chrome (white ring + soft shadow), aspect-square, with a small caption below.
 */
function FinishPreviewPage({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="m-0">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-cream shadow-polaroid ring-8 ring-white">
        {children}
      </div>
      <figcaption className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-soft/80">
        {caption}
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------- book so far */
// The front-matter pages render in the book's own font language (no font picker
// in the wizard, so we use the default "storybook" pairing + the shared script
// face, exactly like the flipbook). Shared here so the Finish step's inline
// previews and the "book so far" panel stay identical.
const FM_PAIRING = FONT_PAIRINGS.storybook;
const FM_DISPLAY = {
  fontFamily: `'${FM_PAIRING.display.family}', sans-serif`,
  fontWeight: FM_PAIRING.display.weight,
} as const;
const FM_SCRIPT = {
  fontFamily: `'${SCRIPT_FONT.family}', cursive`,
  fontWeight: SCRIPT_FONT.weight,
} as const;

/** The printed title page, centred title + imprint line. */
function TitlePageInner({ title, imprint }: { title: string; imprint: string }) {
  return (
    <>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-[12%] pb-[14%] text-center">
        <h3
          className="font-display text-[clamp(1rem,3.4vw,1.6rem)] font-extrabold leading-tight text-ink"
          style={FM_DISPLAY}
        >
          {title}
        </h3>
        <Sparkle className="text-marigold" size={16} />
      </div>
      <p className="absolute inset-x-0 bottom-[7%] text-center text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
        {imprint}
      </p>
    </>
  );
}

/** The printed dedication page: label, the note in a script face, and a signoff. */
function DedicationPageInner({
  label,
  greeting,
  placeholder,
  fromText,
}: {
  label: string;
  greeting: string;
  placeholder: string;
  fromText: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-[11%] text-center">
      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink/35">{label}</p>
      <p
        className="whitespace-pre-line text-[clamp(0.95rem,3.6vw,1.5rem)] leading-snug text-ink"
        style={FM_SCRIPT}
      >
        {greeting.trim() || placeholder}
      </p>
      {fromText ? (
        <p className="text-[clamp(0.85rem,3.2vw,1.3rem)] text-ink-soft" style={FM_SCRIPT}>
          {fromText}
        </p>
      ) : null}
    </div>
  );
}

/** The book cover: the chosen style's art, with the title over a soft scrim. */
function CoverPageInner({
  image,
  title,
  alt,
}: {
  image: string | null;
  title: string;
  alt: string;
}) {
  return (
    <>
      {image ? (
        <ProgressiveImage
          src={image}
          alt={alt}
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <ArtPlaceholder />
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-[8%] px-[10%] text-center">
        <h3
          className="font-display text-[clamp(0.8rem,3vw,1.3rem)] font-extrabold leading-tight text-white drop-shadow"
          style={FM_DISPLAY}
        >
          {title}
        </h3>
      </div>
    </>
  );
}

/** The typed memory as a manuscript snippet on faint ruled lines. */
function StoryPageInner({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col px-[12%] pb-[12%] pt-[16%]">
      <p
        className="overflow-hidden font-body text-ink/85"
        style={{
          fontSize: "0.68rem",
          lineHeight: "1.15rem",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.15rem - 1px), rgb(118 30 11 / 0.12) calc(1.15rem - 1px), rgb(118 30 11 / 0.12) 1.15rem)",
          display: "-webkit-box",
          WebkitLineClamp: 8,
          WebkitBoxOrient: "vertical",
        }}
      >
        {text}
      </p>
    </div>
  );
}

/** The cast page: "starring" over a row of portrait thumbnails + names. */
function CastPageInner({
  label,
  members,
}: {
  label: string;
  members: { key: string; name: string; photo: string | null }[];
}) {
  const shown = members.slice(0, 4);
  const names = members.map((m) => m.name).filter((n) => n.length > 0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-[10%] text-center">
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink/40">{label}</p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {shown.map((m) =>
          m.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.key}
              src={m.photo}
              alt=""
              className="h-8 w-8 rounded-full object-cover shadow-sm ring-2 ring-white"
            />
          ) : (
            <span
              key={m.key}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender font-display text-[0.7rem] font-bold text-ink ring-2 ring-white"
              aria-hidden="true"
            >
              {m.name.slice(0, 1).toUpperCase() || "?"}
            </span>
          ),
        )}
      </div>
      {names.length > 0 ? (
        <p className="font-display text-[0.62rem] font-bold leading-tight text-ink">
          {names.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The persistent "your book so far" preview: a small stack (rail, lg+) or strip
 * (<lg) of mini front/front-matter pages that grows as the wizard is filled in.
 * Purely presentational — every value comes from the wizard's own state. Only
 * pages with real content render; front-matter pages (title/dedication) show in
 * the rail only, since <lg the Finish step carries its own larger previews.
 */
function BookSoFar({
  layout,
  selectedStyle,
  template,
  memoryText,
  people,
  title,
  greeting,
  greetingFrom,
}: {
  layout: "rail" | "strip";
  selectedStyle: StyleSummary | null;
  template: TemplateSummary | null;
  memoryText: string;
  people: PersonDraft[];
  title: string;
  greeting: string;
  greetingFrom: string;
}) {
  const t = useTranslations("wizard");
  const tFlip = useTranslations("flipbook");

  const includeFrontMatter = layout === "rail";
  const coverTitle = title.trim() || template?.title || t("bookSoFarCoverTitle");
  const castMembers = people
    .filter((p) => p.photoUrls[0] || p.name.trim())
    .map((p) => ({ key: p.key, name: p.name.trim(), photo: p.photoUrls[0] ?? null }));

  const pages: { key: string; caption: string; node: React.ReactNode }[] = [];
  if (selectedStyle) {
    pages.push({
      key: "cover",
      caption: tFlip("cover"),
      node: (
        <CoverPageInner
          image={selectedStyle.previewImageUrl}
          title={coverTitle}
          alt={t("styleCardAlt", { name: selectedStyle.name })}
        />
      ),
    });
  }
  if (memoryText.trim()) {
    pages.push({
      key: "story",
      caption: t("bookSoFarStory"),
      node: <StoryPageInner text={memoryText.trim()} />,
    });
  }
  if (castMembers.length > 0) {
    pages.push({
      key: "cast",
      caption: t("bookSoFarCast"),
      node: <CastPageInner label={t("bookSoFarCastStarring")} members={castMembers} />,
    });
  }
  if (includeFrontMatter && title.trim()) {
    pages.push({
      key: "title",
      caption: tFlip("titlePage"),
      node: <TitlePageInner title={title.trim()} imprint={tFlip("imprint")} />,
    });
  }
  if (includeFrontMatter && greeting.trim()) {
    pages.push({
      key: "dedication",
      caption: tFlip("dedication"),
      node: (
        <DedicationPageInner
          label={tFlip("dedication")}
          greeting={greeting}
          placeholder={tFlip("dedicationPlaceholder")}
          fromText={
            greetingFrom.trim() ? tFlip("dedicationFrom", { name: greetingFrom.trim() }) : null
          }
        />
      ),
    });
  }

  // Loads the pairing + script Google fonts whenever the panel is on screen
  // (React hoists + dedupes this <link> with the Finish step's identical one).
  const fontLink = <link rel="stylesheet" href={fontStylesheetUrl(FM_PAIRING)} />;

  if (layout === "strip") {
    if (pages.length === 0) return null;
    return (
      <section aria-label={t("bookSoFarHeading")}>
        {fontLink}
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-soft/80">
          {t("bookSoFarHeading")}
        </p>
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((page) => (
            <div key={page.key} className="animate-page-in w-28 shrink-0 snap-start">
              <FinishPreviewPage caption={page.caption}>{page.node}</FinishPreviewPage>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t("bookSoFarHeading")} className="mt-5">
      {fontLink}
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-soft/80">
        {t("bookSoFarHeading")}
      </p>
      {pages.length === 0 ? (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-ink/10 px-5 py-8 text-center text-xs leading-relaxed text-ink-soft/70">
          {t("bookSoFarEmpty")}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4">
          {pages.map((page, i) => (
            <div
              key={page.key}
              className={`animate-page-in w-full max-w-[11rem] ${i % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
            >
              <FinishPreviewPage caption={page.caption}>{page.node}</FinishPreviewPage>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
