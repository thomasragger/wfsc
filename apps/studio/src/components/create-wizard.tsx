"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { Card, Polaroid } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { Chip, PillLabel } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { IconCart, IconChevronLeft, IconChevronRight, IconClose, IconUser } from "@/components/ui/icons";
import { Field, Select, TextInput } from "@/components/ui/input";
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
  suggestFrontMatter,
  uploadPhoto,
  type CategorySummary,
  type StyleSummary,
  type TemplateSummary,
} from "@/lib/client-api";

// One focused decision per screen (Typeform/Duolingo-style). The template
// hero is a pre-step; these four are the stepper. The story leads (the memory
// is the emotional hook), then who's in it, then dressing THAT story in a
// look, then reviewing the book. All logic addresses steps by id — indices
// are derived — so this array is the single source of truth for ordering; the
// ids double as stable, locale-independent analytics step names. Displayed
// labels come from the "steps" translation array (same order).
const STEPS = ["story", "cast", "style", "finish"] as const;
type StepId = (typeof STEPS)[number];

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

const DRAFT_VERSION = 3 as const;
const DRAFT_PREFIX = "wfsc:wizard-draft";

/** Step order of draft schema v2 (numeric step), for migrating stored drafts. */
const V2_STEP_ORDER: readonly StepId[] = ["style", "story", "cast", "finish"];

interface WizardDraft {
  v: typeof DRAFT_VERSION;
  step: StepId;
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
    // v3 stores the step as an id; v2 stored a numeric index under the OLD
    // step order and migrates by mapping (never crash on a stale draft —
    // anything unrecognizable clamps back to the first step).
    if (o.v !== DRAFT_VERSION && o.v !== 2) return null;
    let step: StepId = STEPS[0];
    if (o.v === DRAFT_VERSION) {
      if (typeof o.step === "string" && (STEPS as readonly string[]).includes(o.step)) {
        step = o.step as StepId;
      }
    } else if (typeof o.step === "number") {
      step = V2_STEP_ORDER[o.step] ?? STEPS[0];
    }
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
      step,
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
    d.step !== STEPS[0] ||
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
  const stepId: StepId = STEPS[step];
  const [started, setStarted] = useState(false); // dismisses the template hero
  // Deferred email capture: the review step's CTA first reveals a compact
  // "where should we send it?" moment; only its confirm actually submits.
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  // The step column's internal scroll area (app-shell on lg+): reset to the
  // top on every step change so a new step never starts half-scrolled.
  const stepScrollRef = useRef<HTMLDivElement>(null);
  // Auto-suggested title: fetched at most once per wizard session.
  const [autoTitleTried, setAutoTitleTried] = useState(false);

  // Draft-saved flash: bumped (debounced) after localStorage writes settle,
  // cleared again by the timeout effect below. Non-zero = indicator visible.
  const [savedFlash, setSavedFlash] = useState(0);
  useEffect(() => {
    if (savedFlash === 0) return;
    const timer = setTimeout(() => setSavedFlash(0), 2000);
    return () => clearTimeout(timer);
  }, [savedFlash]);
  const draftSavedVisible = savedFlash > 0;

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
      step: STEPS[step],
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
      return; // storage full / disabled: non-fatal, and nothing was saved
    }
    // Surface "Draft saved" only once writes settle (each change resets the
    // timer via this effect's cleanup), so it never flickers per keystroke.
    const settle = setTimeout(() => setSavedFlash(Date.now()), 800);
    return () => clearTimeout(settle);
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
    setStep(Math.max(0, STEPS.indexOf(d.step)));
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

  // Only block submit on a token when Turnstile is actually configured. In dev
  // the widget calls onVerify("") immediately and the server skips verification.
  const turnstileRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const canContinue = useMemo(() => {
    switch (stepId) {
      case "story":
        return memoryText.trim().length >= 20;
      case "cast":
        return (
          people.length >= 1 &&
          people.every((p) => p.name.trim().length > 0 && p.photoUrls.length >= 1) &&
          !uploadsInFlight
        );
      case "style":
        return styleId !== null;
      case "finish":
        // The review step's CTA is always available (title/dedication are
        // optional); once the email capture is open, the same button becomes
        // the real submit and needs email + consent (+ Turnstile when set up).
        return confirmOpen
          ? consent && emailValid && (!turnstileRequired || turnstileToken !== "")
          : true;
    }
  }, [
    stepId,
    styleId,
    memoryText,
    people,
    uploadsInFlight,
    emailValid,
    consent,
    confirmOpen,
    turnstileRequired,
    turnstileToken,
  ]);

  // Whether anything has landed in the scrapbook yet (mirrors BookSoFar's
  // card conditions) — gates the rail's "taking shape" motivator.
  const scrapbookHasCards = useMemo(
    () =>
      Boolean(
        memoryText.trim() ||
          people.some((p) => p.photoUrls[0]) ||
          styleId ||
          title.trim() ||
          greeting.trim(),
      ),
    [styleId, title, greeting, memoryText, people],
  );

  function goTo(next: number) {
    if (next > step) track("wizard_step_completed", { step, step_name: STEPS[step] });
    setError(null);
    setConfirmOpen(false);
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    stepScrollRef.current?.scrollTo({ top: 0 });
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
  // (<lg): an open email capture dismisses back to the review, step 0 with a
  // template goes back to the hero, otherwise to the previous step. Rendered
  // fresh in each place so both stay in sync.
  const backButton = (variant: "ghost", className: string) =>
    confirmOpen ? (
      <Button variant={variant} className={className} onClick={() => setConfirmOpen(false)}>
        {t("back")}
      </Button>
    ) : step > 0 ? (
      <Button variant={variant} className={className} onClick={() => goTo(step - 1)}>
        {t("back")}
      </Button>
    ) : template ? (
      <Button variant={variant} className={className} onClick={() => setStarted(false)}>
        {t("back")}
      </Button>
    ) : null;

  const openConfirm = () => {
    setConfirmOpen(true);
    stepScrollRef.current?.scrollTo({ top: 0 });
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Scrapbook cards double as shortcuts to the step where that ingredient is
  // edited (the carousel's arrows/dots/swipe still only browse the scrapbook).
  const editFromScrapbook = (target: StepId) => {
    const idx = STEPS.indexOf(target);
    if (idx !== step || confirmOpen) goTo(idx);
  };

  const forwardButton = (className: string) =>
    stepId !== "finish" ? (
      <Button
        variant="secondary"
        className={className}
        disabled={!canContinue}
        pending={stepId === "cast" && uploadsInFlight}
        pendingLabel={t("uploadingPhotos")}
        onClick={() => goTo(step + 1)}
      >
        {t("continue")}
      </Button>
    ) : !confirmOpen ? (
      // First press reveals the email capture; the actual submit happens there
      // (or via this same button once the capture is open, below).
      <Button className={className} onClick={openConfirm}>
        {t("createPreview")}
      </Button>
    ) : (
      <Button
        className={className}
        disabled={!canContinue}
        pending={submitting}
        pendingLabel={t("creatingPreview")}
        onClick={() => void submit()}
      >
        {t("createPreview")}
      </Button>
    );

  return (
    <PageTransition className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* App shell on lg+: the studio layout is a bounded viewport column
          (header / main / footer, zero body scroll) and the wizard fills the
          main area exactly; the step column scrolls internally in the rare
          case a step exceeds it, and the rail stays fully visible. Normal
          document scrolling on <lg. */}
      <div
        ref={topRef}
        className="scroll-mt-24 pb-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pb-0"
      >
        {/* Horizontal progress only on <lg; the rail carries it on lg+. */}
        <StepProgress steps={stepLabels} current={step} className="mb-5 lg:hidden" />

        <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:gap-8">
          {/* main step column */}
          <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">
            <Card className="overflow-hidden p-5 sm:p-7 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:p-5">
              {/* Internal scroll area (lg+). The negative-margin/padding pair
                  gives tilted cards' shadows and tape overhangs (which reach
                  ~1rem above a note card) room instead of clipping them at
                  the scroll box edge. */}
              <div
                ref={stepScrollRef}
                className="lg:-mx-2 lg:-mt-4 lg:-mb-1 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-2 lg:pb-1 lg:pt-4"
              >
              {/* flex-1 (with default min-height:auto) lets short steps fill
                  the shell so the story note can stretch, while taller steps
                  still grow the scroll area naturally. */}
              <StepTransition
                stepKey={confirmOpen ? "confirm" : step}
                direction={direction}
                className="lg:flex-1"
              >
                {stepId === "story" && (
                  <StoryStep
                    template={template}
                    memoryText={memoryText}
                    onMemoryChange={setMemoryText}
                    targetAge={targetAge}
                    onAgeChange={setTargetAge}
                  />
                )}

                {stepId === "cast" && (
                  <CastStep
                    people={people}
                    onAdd={() => setPeople((prev) => [...prev, newPerson("other")])}
                    onRemove={(key) => setPeople((prev) => prev.filter((p) => p.key !== key))}
                    onUpdate={updatePerson}
                    onAddPhotos={addPhotos}
                  />
                )}

                {stepId === "style" && (
                  <StyleStep
                    styles={styles}
                    stylesError={stylesError}
                    styleId={styleId}
                    onSelect={setStyleId}
                    selectedStyle={selectedStyle}
                    recommendedId={template?.suggestedStyleId ?? null}
                  />
                )}

                {stepId === "finish" &&
                  (confirmOpen ? (
                    // Deferred email capture: the review CTA swapped the card
                    // content for this compact confirm moment.
                    <EmailCapture
                      email={email}
                      onEmailChange={setEmail}
                      consent={consent}
                      onConsentChange={setConsent}
                      canConfirm={canContinue}
                      submitting={submitting}
                      onConfirm={() => void submit()}
                      onDismiss={() => setConfirmOpen(false)}
                      // Abuse control (O5). No-ops in dev: renders nothing and
                      // reports an empty token, which the server accepts.
                      turnstile={<Turnstile onVerify={setTurnstileToken} action="create-book" />}
                    />
                  ) : (
                    <FinishStep
                      template={template}
                      title={title}
                      onTitleChange={setTitle}
                      greeting={greeting}
                      onGreetingChange={setGreeting}
                      memoryText={memoryText}
                      castNames={people.map((p) => p.name.trim()).filter(Boolean)}
                      targetAge={targetAge}
                      titleAutoSuggest={!autoTitleTried}
                      onTitleAutoSuggest={() => setAutoTitleTried(true)}
                    />
                  ))}
              </StepTransition>

              {error ? <Alert className="mt-5">{error}</Alert> : null}
              </div>
            </Card>
          </div>

          {/* Right rail (lg+ only): a slim actions card on top (Continue is
              always in view inside the fixed shell), then the scrapbook —
              anchored here on EVERY step, review included. The negative-
              margin/padding pair keeps the tilted cards' shadows unclipped if
              the rail ever needs its fallback scroll. */}
          <aside className="hidden lg:block lg:min-h-0">
            {/* pb-0 so the scrapbook's dots sit flush with the step card's
                bottom edge (the actions card top already matches its top). */}
            <div className="-mx-3 flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-3">
              <Card className="shrink-0 p-4">
                <div className="flex items-center justify-between gap-3">
                  {/* Progress in the user's currency: their story taking
                      shape, not form steps. The pills keep step orientation
                      on the right. */}
                  <p className="min-w-0 truncate font-display text-sm font-bold text-ink">
                    {stepId === "finish"
                      ? t("railAlmost")
                      : scrapbookHasCards
                        ? t("railProgress")
                        : stepLabels[step]}
                  </p>
                  {/* Condensed step progress: one pill per step. */}
                  <div
                    className="flex shrink-0 items-center gap-1.5"
                    role="img"
                    aria-label={t("stepCount", { current: step + 1, total: STEPS.length })}
                  >
                    {stepLabels.map((label, i) => (
                      <span
                        key={label}
                        title={label}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          i === step ? "w-6 bg-coral" : i < step ? "w-2 bg-sage" : "w-2 bg-ink/15"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {backButton("ghost", "shrink-0")}
                  {forwardButton("min-w-0 flex-1 whitespace-nowrap")}
                </div>
                <p className="mt-3 text-center text-xs text-ink-soft">{t("heroFreePreview")}</p>
                {/* Draft-saved flash: space is reserved (fixed height) so the
                    line never shifts the layout. */}
                <p
                  aria-live="polite"
                  className={`mt-1 h-4 text-center text-[11px] font-semibold text-sage transition-opacity duration-300 motion-reduce:transition-none ${
                    draftSavedVisible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {draftSavedVisible ? `✓ ${t("draftSaved")}` : null}
                </p>
              </Card>

              {/* The scrapbook of ingredients, growing with every choice —
                  anchored here on every step, review included. mt-auto pins
                  its bottom edge to the shell's bottom; the width cap keeps
                  the square stage short enough to fit 730px-tall viewports,
                  and the fixed stage/caption/dot rows mean the block's
                  footprint is identical empty or full (no jumping). */}
              <BookSoFar
                className="mx-auto mt-auto w-full max-w-[18rem] pt-5"
                showEmpty
                selectedStyle={selectedStyle}
                memoryText={memoryText}
                people={people}
                title={title}
                greeting={greeting}
                greetingFrom={greetingFrom}
                onEdit={editFromScrapbook}
              />
            </div>
          </aside>
        </div>

        {/* The scrapbook on <lg: one fixed home on every step, between the
            step card and the inline nav (hidden while empty). */}
        <BookSoFar
          className="mx-auto mt-5 w-full max-w-md lg:hidden"
          selectedStyle={selectedStyle}
          memoryText={memoryText}
          people={people}
          title={title}
          greeting={greeting}
          greetingFrom={greetingFrom}
          onEdit={editFromScrapbook}
        />

        {/* Step navigation on <lg: inline under the step card (the rail carries
            the actions on lg+). */}
        <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
          {backButton("ghost", "") ?? <span />}
          {forwardButton("")}
        </div>
        {/* Draft-saved flash (mobile home); height reserved, no layout shift. */}
        <p
          aria-live="polite"
          className={`mt-2 h-4 text-center text-[11px] font-semibold text-sage transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
            draftSavedVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {draftSavedVisible ? `✓ ${t("draftSaved")}` : null}
        </p>
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
  selectedStyle,
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
    <section className="flex flex-col gap-5 lg:h-full lg:gap-4">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("styleTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("styleSubtitle")}
        </p>
      </header>

      {/* Picker + real sample pages center vertically as a group on lg+. */}
      <div className="flex flex-col gap-5 lg:min-h-0 lg:flex-1 lg:justify-center lg:gap-4">
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

        {/* Honest proof: real rendered spreads from sample books in the chosen
            style. Omitted gracefully for styles without sample books. */}
        {selectedStyle && selectedStyle.sampleSpreadUrls.length > 0 ? (
          <div key={selectedStyle.id} className="animate-page-in">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink/70">
              {t("styleSampleHeading")}
            </p>
            <div className="mt-3 grid max-w-sm grid-cols-2 gap-3 lg:max-w-[17rem]">
              {selectedStyle.sampleSpreadUrls.map((url) => (
                <ProgressiveImage
                  key={url}
                  src={url}
                  alt={t("styleSampleAlt", { name: selectedStyle.name })}
                  className="aspect-square w-full rounded-xl shadow-fuzzy ring-4 ring-white"
                  imgClassName="h-full w-full object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
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
      className={`tile-lift group relative w-56 shrink-0 overflow-hidden rounded-2xl border-2 bg-white text-left lg:w-48 ${
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
            <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-ink-soft lg:line-clamp-2">{style.description}</p>
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
    <section className="flex flex-col gap-6 lg:h-full lg:gap-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
          {template ? t("storyTitleTemplate") : t("storyTitleOwn")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {template ? t("storySubtitleTemplate") : t("storySubtitleOwn")}
        </p>
        {/* Age band as a sentence-like inline choice (tunes the wording). */}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5"
          role="radiogroup"
          aria-label={t("ageRadioLabel")}
        >
          <span className="text-sm text-ink-soft">{t("whoForInline")}</span>
          {AGE_BANDS.map((band, i) => (
            <Chip
              key={band.value}
              role="radio"
              selected={targetAge === band.value}
              onClick={() => onAgeChange(targetAge === band.value ? null : band.value)}
              className="!px-3 !py-1 !text-xs"
            >
              {ageBandLabels[i]}
            </Chip>
          ))}
        </div>
      </header>

      <div
        className={`grid gap-6 pt-3 lg:min-h-0 lg:flex-1 ${
          hasBeats ? "lg:grid-cols-2 lg:items-stretch" : ""
        }`}
      >
        {/* Left: the memory as a generous writable taped post-it — the same
            note the rail scrapbook shows in miniature (same tape, paper,
            ruled lines). Capped at a comfortable writing size and centered in
            the available space; the writing itself is large. */}
        <div className="flex min-h-0 flex-col lg:items-center lg:justify-center">
          <div
            className="relative flex w-full max-w-[36rem] flex-col rounded-lg bg-white px-6 pb-6 pt-7 shadow-fuzzy ring-1 ring-ink/5 transition-shadow focus-within:ring-2 focus-within:ring-marigold/70 lg:min-h-0 lg:max-h-[23rem] lg:flex-1"
            style={{ rotate: "-0.5deg" }}
          >
            {/* The tape strip doubles as the note's label. */}
            <label
              htmlFor="memory"
              className="absolute -top-3 left-1/2 -translate-x-1/2 rotate-[-3deg] whitespace-nowrap rounded-[2px] bg-marigold/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink/70 shadow-sm"
            >
              {template ? t("memoryLabelTemplate") : t("memoryLabelOwn")}
            </label>
            <textarea
              id="memory"
              className="block min-h-44 w-full flex-1 resize-none border-0 bg-transparent p-0 font-body text-lg text-ink placeholder:text-ink-soft/50 focus:outline-none focus:ring-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(2.25rem - 1px), rgb(118 30 11 / 0.12) calc(2.25rem - 1px), rgb(118 30 11 / 0.12) 2.25rem)",
                backgroundAttachment: "local",
                lineHeight: "2.25rem",
              }}
              placeholder={
                template
                  ? t("memoryPlaceholderTemplate", { noun: templateNoun(template.title) })
                  : memoryPrompts[0]
              }
              value={memoryText}
              onChange={(e) => onMemoryChange(e.target.value)}
            />
          </div>
        </div>

        {/* Right: the story shape (template only). */}
        {hasBeats ? (
          <div className="rounded-2xl bg-gradient-to-br from-lavender/60 via-cream to-peach/50 p-5 lg:self-center">
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
    <section className="flex flex-col gap-5 lg:h-full">
      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("castTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("castSubtitle")}
        </p>
      </header>

      {/* Character cards: the uploaded photo becomes the character preview;
          the last card adds another person. Three-up on sm+ (add-person card
          in-grid); on <sm three or more people become a swipeable carousel.
          On lg+ the group centers vertically instead of hugging the top. */}
      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center">
      <div
        className={
          people.length >= 3
            ? "-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3"
        }
      >
        {people.map((person) => {
          // Progressive capture: a fresh person is just a friendly name
          // question; the photo upload and relation picker reveal once a
          // name is typed (or the card already has photos/uploads).
          const personStarted =
            person.name.trim().length > 0 || person.photoUrls.length > 0 || person.uploading > 0;
          return (
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

            <label
              htmlFor={`name-${person.key}`}
              className="mb-1 mt-0.5 block pr-8 text-xs font-bold text-ink"
            >
              {t("castNamePrompt")}
            </label>
            <TextInput
              id={`name-${person.key}`}
              placeholder={t("castNamePlaceholder")}
              value={person.name}
              maxLength={80}
              className="py-2 text-sm"
              onChange={(e) => onUpdate(person.key, { name: e.target.value })}
            />

            {personStarted ? (
              <>
                <label className="group relative mt-2 block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-lavender">
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

                {/* Compact do/don't photo guidance, right at the upload point
                    (only while there's no photo yet). */}
                {person.photoUrls.length === 0 && person.uploading === 0 ? (
                  <div className="mt-2">
                    <p className="text-[11px] leading-snug text-ink-soft">{t("castPhotoGuide")}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold text-ink">
                        <span className="font-bold text-sage" aria-hidden="true">
                          ✓
                        </span>
                        {t("castPhotoDo")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-semibold text-ink">
                        <IconClose className="h-3 w-3 text-coral" />
                        {t("castPhotoDont")}
                      </span>
                    </div>
                  </div>
                ) : null}

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

                <Select
                  id={`role-${person.key}`}
                  aria-label={t("castRole")}
                  value={person.role}
                  className="mt-2 py-2 text-sm"
                  onChange={(e) => onUpdate(person.key, { role: e.target.value as PersonRole })}
                >
                  {PERSON_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </Select>
              </>
            ) : null}
          </div>
          );
        })}

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
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- review (finish) */

/**
 * The last step: the title and dedication are written DIRECTLY onto the same
 * taped note cards the scrapbook uses (no form fields), each with a subtle
 * AI suggestion line beneath, plus a tiny "what happens next" strip. Email
 * capture is deferred to the EmailCapture moment that the CTA reveals; the
 * scrapbook itself stays anchored in the rail.
 */
function FinishStep({
  template,
  title,
  onTitleChange,
  greeting,
  onGreetingChange,
  memoryText,
  castNames,
  targetAge,
  titleAutoSuggest,
  onTitleAutoSuggest,
}: {
  template: TemplateSummary | null;
  title: string;
  onTitleChange: (v: string) => void;
  greeting: string;
  onGreetingChange: (v: string) => void;
  /** Context for the AI suggestion helpers (never displayed here). */
  memoryText: string;
  castNames: string[];
  targetAge: number | null;
  /** Auto-suggest a title on arrival, at most once per wizard session. */
  titleAutoSuggest: boolean;
  onTitleAutoSuggest: () => void;
}) {
  const t = useTranslations("wizard");

  return (
    <section className="flex flex-col gap-6 lg:h-full">
      {/* React hoists this to <head>; loads the cards' display+script fonts. */}
      <link rel="stylesheet" href={fontStylesheetUrl(FM_PAIRING)} />

      <header>
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{t("finishTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("finishSubtitle")}
        </p>
      </header>

      {/* Writable note cards, vertically centered in the available space on
          lg+: the user writes straight onto the card. pt-3 keeps the tape
          strips fully visible. */}
      <div className="mx-auto grid w-full max-w-2xl gap-x-8 gap-y-7 pt-3 lg:min-h-0 lg:flex-1 lg:content-center lg:grid-cols-2 lg:items-start">
        <div>
          <WritableNoteCard
            id="title"
            label={t("finishBookTitle")}
            tilt="-1deg"
            value={title}
            onChange={onTitleChange}
            placeholder={template ? template.title : t("finishTitlePlaceholder")}
            maxLength={120}
            textStyle={FM_DISPLAY}
            textClassName="font-display text-xl font-extrabold leading-tight"
          />
          <SuggestLine
            kind="title"
            value={title}
            onApply={onTitleChange}
            memoryText={memoryText}
            templateTitle={template?.title}
            castNames={castNames}
            targetAge={targetAge}
            autoFetch={titleAutoSuggest}
            onAutoFetch={onTitleAutoSuggest}
          />
        </div>

        <div>
          <WritableNoteCard
            id="greeting"
            label={t("finishNote")}
            tilt="1deg"
            value={greeting}
            onChange={onGreetingChange}
            placeholder={t("finishNotePlaceholder")}
            maxLength={600}
            multiline
            textStyle={FM_SCRIPT}
            textClassName="text-lg leading-relaxed"
          />
          <SuggestLine
            kind="dedication"
            value={greeting}
            onApply={onGreetingChange}
            memoryText={memoryText}
            templateTitle={template?.title}
            castNames={castNames}
            targetAge={targetAge}
          />
        </div>
      </div>

      {/* What happens next: three tiny steps near the CTA. */}
      <ol className="grid gap-2.5 border-t border-ink/10 pt-5 sm:grid-cols-3">
        <NextStep icon={<Sparkle size={13} />} text={t("finishNextPreview")} />
        <NextStep icon={<IconUser className="h-3.5 w-3.5" />} text={t("finishNextReview")} />
        <NextStep icon={<IconCart className="h-3.5 w-3.5" />} text={t("finishNextShip")} />
      </ol>
    </section>
  );
}

/**
 * A taped note card the user writes on: the input visually IS the card
 * (transparent field, card chrome around it, tape strip doubling as the
 * label). Same visual language as the scrapbook's note cards.
 */
function WritableNoteCard({
  id,
  label,
  tilt,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline = false,
  textStyle,
  textClassName = "",
}: {
  id: string;
  label: string;
  tilt: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  textStyle: React.CSSProperties;
  textClassName?: string;
}) {
  const fieldClass =
    `block w-full border-0 bg-transparent text-center text-ink placeholder:text-ink/25 focus:outline-none focus:ring-0 ${textClassName}`.trim();
  return (
    <div
      className="relative rounded-lg bg-white px-6 pb-6 pt-7 shadow-fuzzy ring-1 ring-ink/5 transition-shadow focus-within:ring-2 focus-within:ring-marigold/70"
      style={{ rotate: tilt }}
    >
      {/* The tape strip doubles as the card's label. */}
      <label
        htmlFor={id}
        className="absolute -top-3 left-1/2 -translate-x-1/2 rotate-[-3deg] whitespace-nowrap rounded-[2px] bg-marigold/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink/70 shadow-sm"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} resize-none`}
          style={textStyle}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          style={textStyle}
        />
      )}
    </div>
  );
}

/** One entry of the review step's "what happens next" strip. */
function NextStep({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marigold/20 text-ink"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-xs leading-snug text-ink-soft">{text}</span>
    </li>
  );
}

/**
 * Deferred email capture: revealed by the review step's CTA, right before
 * submit. The API contract is unchanged — email + consent still ship with
 * book creation; they're just asked for at the moment they matter.
 */
function EmailCapture({
  email,
  onEmailChange,
  consent,
  onConsentChange,
  canConfirm,
  submitting,
  onConfirm,
  onDismiss,
  turnstile,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  canConfirm: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  turnstile: React.ReactNode;
}) {
  const t = useTranslations("wizard");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 py-2 sm:py-4 lg:h-full lg:justify-center lg:py-0">
      <header className="text-center">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
          {t("emailPromptTitle")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{t("emailPromptBody")}</p>
      </header>

      <div className="flex flex-col gap-4">
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

        {/* Explicit privacy opt-in — gates the confirm button. */}
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

      {/* Abuse control (O5); renders nothing in dev. */}
      <div className="flex justify-center empty:hidden">{turnstile}</div>

      <div className="flex flex-col gap-2.5">
        <Button
          className="w-full"
          disabled={!canConfirm}
          pending={submitting}
          pendingLabel={t("creatingPreview")}
          onClick={onConfirm}
        >
          {t("createPreview")}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onDismiss}>
          {t("emailPromptBack")}
        </Button>
      </div>
    </section>
  );
}

/**
 * The subtle AI line beneath a writable note card. One tap fills the card
 * with a suggestion; "try another" cycles the remaining fetched options
 * before refetching. With `autoFetch`, it fetches once on arrival and
 * prefills an EMPTY card, marked with a small "our suggestion" pill until
 * the user edits (a typed or edited value is never overwritten). Errors stay
 * quiet: one muted line; auto-fetch fails completely silently.
 */
function SuggestLine({
  kind,
  value,
  onApply,
  memoryText,
  templateTitle,
  castNames,
  targetAge,
  autoFetch = false,
  onAutoFetch,
}: {
  kind: "title" | "dedication";
  value: string;
  onApply: (v: string) => void;
  memoryText: string;
  templateTitle?: string;
  castNames: string[];
  targetAge: number | null;
  autoFetch?: boolean;
  onAutoFetch?: () => void;
}) {
  const t = useTranslations("wizard");
  const locale = useLocale();
  const [options, setOptions] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Latest field value, so the async auto-apply never clobbers fresh typing.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const fetchNext = useCallback(
    async (isAuto: boolean) => {
      // Cycle through already-fetched options before hitting the API again.
      if (!isAuto && options.length > 0 && cursor + 1 < options.length) {
        const next = options[cursor + 1];
        setCursor(cursor + 1);
        setLastApplied(next);
        onApply(next);
        return;
      }
      setLoading(true);
      setFailed(false);
      try {
        const fetched = await suggestFrontMatter({
          kind,
          memoryText,
          templateTitle,
          castNames: castNames.length > 0 ? castNames : undefined,
          targetAge: targetAge ?? undefined,
          locale,
        });
        setOptions(fetched);
        setCursor(0);
        const first = fetched[0];
        // Auto mode never overwrites something the user typed meanwhile.
        if (first && (!isAuto || valueRef.current.trim() === "")) {
          setLastApplied(first);
          onApply(first);
        }
      } catch {
        if (!isAuto) setFailed(true); // auto-suggest fails silently
      } finally {
        setLoading(false);
      }
    },
    [options, cursor, kind, memoryText, templateTitle, castNames, targetAge, locale, onApply],
  );

  // Auto-suggest once per wizard session: the parent flag gates remounts, the
  // ref gates re-runs within this mount. Only for an empty field with enough
  // memory text to ground a suggestion (the API minimum).
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoFetch || autoRan.current) return;
    if (memoryText.trim().length < 20) return;
    if (valueRef.current.trim() !== "") return;
    autoRan.current = true;
    onAutoFetch?.();
    void fetchNext(true);
  }, [autoFetch, memoryText, onAutoFetch, fetchNext]);

  const isSuggested =
    lastApplied !== null && value.trim() !== "" && value.trim() === lastApplied.trim();

  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs">
      {isSuggested ? (
        <span className="rounded-full bg-marigold/25 px-2 py-0.5 text-[10px] font-bold text-ink">
          {t("suggestPill")}
        </span>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => void fetchNext(false)}
        className="font-semibold text-ink-soft underline underline-offset-2 transition hover:text-coral disabled:opacity-60"
      >
        {loading ? t("suggestLoading") : options.length > 0 ? t("suggestTryAnother") : t("suggestCta")}
      </button>
      {failed ? <span className="text-ink-soft/70">{t("suggestError")}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------- the scrapbook */
// The scrapbook shows the INGREDIENTS going into the book — the memory as a
// handwritten note, the people as polaroids, the style as a labeled swatch,
// title and dedication as note cards. Nothing here pretends to be a printed
// page. The title/dedication notes borrow the book's default font language
// ("storybook" display face + the shared script face) as a wink at where
// they'll end up.
const FM_PAIRING = FONT_PAIRINGS.storybook;
const FM_DISPLAY = {
  fontFamily: `'${FM_PAIRING.display.family}', sans-serif`,
  fontWeight: FM_PAIRING.display.weight,
} as const;
const FM_SCRIPT = {
  fontFamily: `'${SCRIPT_FONT.family}', cursive`,
  fontWeight: SCRIPT_FONT.weight,
} as const;

/** A scrapbook note card: white paper, soft shadow, a strip of "tape" on top. */
function TapedNote({
  tilt = "-1.5deg",
  className = "",
  children,
}: {
  tilt?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-lg bg-white p-5 shadow-fuzzy ring-1 ring-ink/5 ${className}`.trim()}
      style={{ rotate: tilt }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-4deg] rounded-[2px] bg-marigold/40 shadow-sm"
      />
      {children}
    </div>
  );
}

/** The memory, as a handwritten-style diary note on ruled lines. The card has
 * a FIXED footprint (height + clamped text) so typing never makes it move,
 * grow, or shrink. */
function MemoryNoteCard({ text }: { text: string }) {
  return (
    <TapedNote tilt="-1.5deg" className="h-[14.5rem] w-full max-w-[19rem] overflow-hidden">
      <p
        className="overflow-hidden font-body text-[0.9rem] text-ink/85"
        style={{
          lineHeight: "1.5rem",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.5rem - 1px), rgb(118 30 11 / 0.12) calc(1.5rem - 1px), rgb(118 30 11 / 0.12) 1.5rem)",
          display: "-webkit-box",
          WebkitLineClamp: 8,
          WebkitBoxOrient: "vertical",
        }}
      >
        {text}
      </p>
    </TapedNote>
  );
}

/** The working title, as a note card in the book's display face (fixed
 * footprint: typing on the review step never reflows the scrapbook). */
function TitleNoteCard({ label, title }: { label: string; title: string }) {
  return (
    <TapedNote
      tilt="1.5deg"
      className="flex h-[11.5rem] w-full max-w-[17rem] flex-col items-center justify-center overflow-hidden py-6 text-center"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">{label}</p>
      <p
        className="mt-2 line-clamp-3 text-balance font-display text-xl font-extrabold leading-tight text-ink"
        style={FM_DISPLAY}
      >
        {title}
      </p>
      <Sparkle className="mx-auto mt-2 shrink-0 text-marigold" size={16} />
    </TapedNote>
  );
}

/** The dedication, as a note card in the shared script face (fixed footprint,
 * like the other note cards). */
function DedicationNoteCard({
  label,
  greeting,
  fromText,
}: {
  label: string;
  greeting: string;
  fromText: string | null;
}) {
  return (
    <TapedNote
      tilt="-1deg"
      className="flex h-[15rem] w-full max-w-[18rem] flex-col items-center justify-center overflow-hidden py-6 text-center"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">{label}</p>
      <p
        className="mt-2 line-clamp-5 whitespace-pre-line text-[1.15rem] leading-snug text-ink"
        style={FM_SCRIPT}
      >
        {greeting}
      </p>
      {fromText ? (
        <p className="mt-1 shrink-0 text-[0.95rem] text-ink-soft" style={FM_SCRIPT}>
          {fromText}
        </p>
      ) : null}
    </TapedNote>
  );
}

/** The chosen style as a labeled swatch card — clearly a swatch, not a cover. */
function StyleSwatchCard({ style, tag }: { style: StyleSummary; tag: string }) {
  return (
    <div className="relative w-full max-w-[15rem]" style={{ rotate: "1.5deg" }}>
      <Polaroid
        media={
          style.previewImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={style.previewImageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="aspect-[4/3] w-full">
              <ArtPlaceholder />
            </div>
          )
        }
        caption={style.name}
      />
      <span className="absolute -top-2 left-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft shadow-sm ring-1 ring-ink/10">
        {tag}
      </span>
    </div>
  );
}

/** The cast as a small fan of overlapping polaroids (photo + name). */
function CastPolaroids({
  members,
}: {
  members: { key: string; name: string; photo: string }[];
}) {
  const shown = members.slice(0, 4);
  return (
    <div className="flex items-center justify-center">
      {shown.map((m, i) => (
        <div
          key={m.key}
          className={i > 0 ? "-ml-7" : ""}
          style={{ rotate: i % 2 === 0 ? "-4deg" : "4deg", zIndex: i }}
        >
          <Polaroid
            className={shown.length > 2 ? "w-24" : "w-32"}
            media={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo} alt={m.name} className="aspect-square w-full object-cover" />
            }
            caption={m.name || undefined}
          />
        </div>
      ))}
    </div>
  );
}

/** Prev/next arrow for the book-so-far carousel; fades out at the ends. */
function BookNavArrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-fuzzy ring-1 ring-ink/5 transition hover:bg-marigold disabled:pointer-events-none disabled:opacity-0 ${
        direction === "prev" ? "left-0" : "right-0"
      }`}
    >
      {direction === "prev" ? (
        <IconChevronLeft className="h-4 w-4" />
      ) : (
        <IconChevronRight className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * The persistent scrapbook — a moodboard of the real ingredients going into
 * the book: the memory as a handwritten note, the people as polaroids, the
 * chosen style as a labeled swatch, title + dedication as note cards. Shown
 * as a gentle card-flipping carousel (arrows, swipe, dots). Purely
 * presentational — every value comes from the wizard's own state; cards exist
 * only once they have real content. When a new card appears the carousel
 * auto-advances to it so the user sees their addition land. While empty it
 * renders a small friendly note when `showEmpty` is set (desktop rail),
 * otherwise nothing (mobile).
 */
function BookSoFar({
  className = "",
  showEmpty = false,
  selectedStyle,
  memoryText,
  people,
  title,
  greeting,
  greetingFrom,
  onEdit,
}: {
  className?: string;
  showEmpty?: boolean;
  selectedStyle: StyleSummary | null;
  memoryText: string;
  people: PersonDraft[];
  title: string;
  greeting: string;
  greetingFrom: string;
  /** Cards double as shortcuts to the step where the ingredient is edited. */
  onEdit?: (target: StepId) => void;
}) {
  const t = useTranslations("wizard");
  const tFlip = useTranslations("flipbook");

  const [index, setIndex] = useState(0);
  const [seenKeys, setSeenKeys] = useState<string[] | null>(null);
  // Swipe tracking: start x + the largest distance moved. Pointer capture is
  // taken only once a real drag starts (>6px), so plain taps still reach the
  // card buttons; movedRef survives to the click event so a drag that ends on
  // a card can be suppressed there.
  const swipeStart = useRef<number | null>(null);
  const movedRef = useRef(0);

  // Theatrical moments: when something lands in the scrapbook (style picked,
  // photo finished uploading), the carousel jumps to that card and pulses it,
  // with an optional transient caption ("Mia is in the book!"). The nonce (the
  // style id / person key that triggered it — deterministic, render-pure)
  // retriggers the CSS animation; a timeout (in the effect below) clears it.
  const [flourish, setFlourish] = useState<{
    page: string;
    nonce: string;
    caption?: string;
  } | null>(null);
  useEffect(() => {
    if (!flourish) return;
    const timer = setTimeout(() => setFlourish(null), flourish.caption ? 2000 : 900);
    return () => clearTimeout(timer);
  }, [flourish]);

  // Polaroids need an actual photo (the scrapbook holds real ingredients).
  const castMembers = people
    .filter((p) => p.photoUrls[0])
    .map((p) => ({ key: p.key, name: p.name.trim(), photo: p.photoUrls[0] }));

  // Cards in the order they're gathered; each appears once it has real content.
  const pages: {
    key: string;
    caption: string;
    target: StepId;
    editLabel: string;
    node: React.ReactNode;
  }[] = [];
  if (memoryText.trim()) {
    pages.push({
      key: "memory",
      caption: t("bookSoFarStory"),
      target: "story",
      editLabel: t("bookSoFarEditMemory"),
      node: <MemoryNoteCard text={memoryText.trim()} />,
    });
  }
  if (castMembers.length > 0) {
    pages.push({
      key: "cast",
      caption: t("bookSoFarCast"),
      target: "cast",
      editLabel: t("bookSoFarEditCast"),
      node: <CastPolaroids members={castMembers} />,
    });
  }
  if (selectedStyle) {
    pages.push({
      key: "style",
      caption: t("bookSoFarStyleCaption"),
      target: "style",
      editLabel: t("bookSoFarEditStyle"),
      node: <StyleSwatchCard style={selectedStyle} tag={t("bookSoFarStyleTag")} />,
    });
  }
  if (title.trim()) {
    pages.push({
      key: "title",
      caption: t("finishBookTitle"),
      target: "finish",
      editLabel: t("bookSoFarEditTitle"),
      node: <TitleNoteCard label={t("finishBookTitle")} title={title.trim()} />,
    });
  }
  if (greeting.trim()) {
    pages.push({
      key: "dedication",
      caption: tFlip("dedication"),
      target: "finish",
      editLabel: t("bookSoFarEditDedication"),
      node: (
        <DedicationNoteCard
          label={tFlip("dedication")}
          greeting={greeting}
          fromText={
            greetingFrom.trim() ? tFlip("dedicationFrom", { name: greetingFrom.trim() }) : null
          }
        />
      ),
    });
  }

  // Auto-advance ONLY for discrete events (a photo landing, a style pick):
  // text-driven cards (memory, title, dedication) appear silently in the dots
  // so typing never yanks the carousel around. State is adjusted during
  // render (React's documented "adjust state when props change" pattern), so
  // the track moves in the same commit the new card mounts in. The very first
  // render with content (a resumed draft) records the cards without advancing.
  const keys = pages.map((p) => p.key);
  if (seenKeys === null ? keys.length > 0 : seenKeys.join("\n") !== keys.join("\n")) {
    if (seenKeys !== null) {
      let appeared = -1;
      keys.forEach((k, i) => {
        if (!seenKeys.includes(k) && (k === "cast" || k === "style")) appeared = i;
      });
      if (appeared >= 0) setIndex(appeared);
      else if (index >= keys.length) setIndex(Math.max(0, keys.length - 1));
    }
    setSeenKeys(keys);
  }

  // Style choice landing: a different style repaints the existing swatch card,
  // so jump back to it and pulse. Same render-time adjustment pattern; the
  // initializer swallows a style preselected before mount (template, draft).
  const [lastStyleId, setLastStyleId] = useState<string | null>(selectedStyle?.id ?? null);
  if ((selectedStyle?.id ?? null) !== lastStyleId) {
    setLastStyleId(selectedStyle?.id ?? null);
    if (selectedStyle && seenKeys !== null) {
      const styleIndex = keys.indexOf("style");
      if (styleIndex >= 0) setIndex(styleIndex);
      setFlourish({ page: "style", nonce: selectedStyle.id });
    }
  }

  // Photo landing: a cast member gaining their first photo jumps to the
  // polaroids with a short caption flourish ("{name} is in the book!").
  const photoSig = castMembers.map((m) => m.key).join("|");
  const [lastPhotoSig, setLastPhotoSig] = useState<string | null>(null);
  if (lastPhotoSig === null) {
    setLastPhotoSig(photoSig); // first render only records (drafts, remounts)
  } else if (photoSig !== lastPhotoSig) {
    const before = new Set(lastPhotoSig.split("|").filter(Boolean));
    const joined = castMembers.find((m) => !before.has(m.key));
    setLastPhotoSig(photoSig);
    if (joined) {
      const castIndex = keys.indexOf("cast");
      if (castIndex >= 0) setIndex(castIndex);
      setFlourish({
        page: "cast",
        nonce: joined.key,
        caption: joined.name ? t("bookSoFarJoined", { name: joined.name }) : undefined,
      });
    }
  }

  const current = Math.min(index, Math.max(0, pages.length - 1));

  if (pages.length === 0 && !showEmpty) return null;

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(pages.length - 1, i)));

  // One fixed skeleton for empty AND filled states — heading, an aspect-square
  // stage, a reserved caption row, a reserved dots row — so nothing jumps when
  // the first card arrives (the empty note simply swaps for the card inside
  // the same stage) or when dots appear for the second card.
  return (
    <section aria-label={t("bookSoFarHeading")} className={className}>
      {/* React hoists this to <head>; loads the pairing + script Google fonts
          used by the title / dedication note cards. */}
      {pages.length > 0 ? <link rel="stylesheet" href={fontStylesheetUrl(FM_PAIRING)} /> : null}
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-soft/80">
        {t("bookSoFarHeading")}
      </p>

      {/* -mx-3 cancels the slides' px-3 (room for the tilted cards' shadows
          inside the clipping viewport), so the scrapbook stage spans the full
          column like the cards around it. */}
      <div className="relative -mx-3">
        {pages.length === 0 ? (
          // Empty scrapbook: same fixed stage, a small friendly note inside.
          <div className="flex aspect-square w-full items-center justify-center px-5 pb-5 pt-4">
            <TapedNote tilt="-2deg" className="max-w-[15rem] py-6 text-center">
              <p className="text-sm leading-relaxed text-ink-soft">{t("bookSoFarEmpty")}</p>
            </TapedNote>
          </div>
        ) : (
          /* The viewport clips the sliding track. touch-pan-y leaves vertical
             scrolling native while we read horizontal swipes. Pointer capture
             starts only after a real drag (>6px) so plain taps still click the
             card buttons; a capture-phase click guard swallows the click that
             trails a swipe. */
          <div
            className="touch-pan-y select-none overflow-hidden"
            onPointerDown={(e) => {
              swipeStart.current = e.clientX;
              movedRef.current = 0;
            }}
            onPointerMove={(e) => {
              if (swipeStart.current === null) return;
              const moved = Math.abs(e.clientX - swipeStart.current);
              movedRef.current = Math.max(movedRef.current, moved);
              if (moved > 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerUp={(e) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (start === null) return;
              const dx = e.clientX - start;
              if (dx <= -40) goTo(current + 1);
              else if (dx >= 40) goTo(current - 1);
            }}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
            onClickCapture={(e) => {
              // A drag that ended on a card must not also activate it.
              if (movedRef.current > 8) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {pages.map((page, i) => {
                const celebrating = flourish?.page === page.key;
                return (
                  <div
                    key={page.key}
                    className="flex aspect-square w-full shrink-0 items-center justify-center px-5 pb-5 pt-4"
                    aria-hidden={i !== current}
                  >
                    {/* Keyed on the flourish nonce so repeat celebrations replay
                        the pulse (reduced motion disables it in CSS). */}
                    <div
                      key={celebrating ? flourish.nonce : "still"}
                      className={`flex w-full justify-center ${celebrating ? "animate-celebrate" : ""}`.trim()}
                    >
                      {onEdit ? (
                        // The card is a shortcut to the step where it's edited.
                        <button
                          type="button"
                          tabIndex={i === current ? 0 : -1}
                          aria-label={page.editLabel}
                          onClick={() => onEdit(page.target)}
                          className="flex w-full cursor-pointer justify-center rounded-lg text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-cobalt motion-reduce:transition-none"
                        >
                          {page.node}
                        </button>
                      ) : (
                        page.node
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pages.length > 1 ? (
          <>
            <BookNavArrow
              direction="prev"
              label={tFlip("previousPage")}
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
            />
            <BookNavArrow
              direction="next"
              label={tFlip("nextPage")}
              disabled={current === pages.length - 1}
              onClick={() => goTo(current + 1)}
            />
          </>
        ) : null}
      </div>

      {/* Caption of the visible card (briefly swapped for a celebration line
          while a flourish runs); height reserved even while empty. */}
      <p className="-mt-2 h-5 text-center font-display text-sm font-bold text-ink">
        {pages.length === 0 ? null : flourish?.caption &&
          flourish.page === pages[current].key ? (
          <span key={flourish.nonce} className="animate-page-in inline-block text-coral">
            {flourish.caption}
          </span>
        ) : (
          pages[current].caption
        )}
      </p>
      {/* One dot per card; row height reserved so the dots' arrival with the
          second card never shifts the composition. */}
      <div className="mt-2 flex h-2.5 items-center justify-center gap-1.5">
        {pages.length > 1
          ? pages.map((page, i) => (
              <button
                key={page.key}
                type="button"
                aria-label={page.caption}
                aria-current={i === current ? "true" : undefined}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-6 bg-coral" : "w-2.5 bg-ink/15 hover:bg-ink/30"
                }`}
              />
            ))
          : null}
      </div>
    </section>
  );
}
