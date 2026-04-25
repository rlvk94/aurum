"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "~/app/_components/button";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { cn } from "~/app/_lib/utils";

import { useTutorial } from "./use-tutorial";
import type { TutorialPlacement, TutorialStep } from "./tutorial-steps";

const CARD_WIDTH = 360;
const CARD_MARGIN = 16;
const VIEWPORT_PADDING = 16;
const MISSING_TARGET_GRACE_MS = 600;

type Rect = { top: number; left: number; width: number; height: number };

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selector || typeof document === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      return;
    }

    const targetSelector = selector;
    let observedElement: Element | null = null;
    let ro: ResizeObserver | null = null;

    function observeElement(el: Element | null) {
      if (el === observedElement) return;
      ro?.disconnect();
      observedElement = el;
      ro =
        el && "ResizeObserver" in window
          ? new ResizeObserver(() => measure())
          : null;
      if (el && ro) ro.observe(el);
    }

    function measure() {
      const el = document.querySelector(targetSelector);
      observeElement(el);
      setRect(el ? readRect(el) : null);
    }

    measure();

    const mo =
      "MutationObserver" in window ? new MutationObserver(measure) : null;
    mo?.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector]);

  return rect;
}

function pickPlacement(
  preferred: TutorialPlacement | undefined,
  target: Rect,
  cardWidth: number,
  cardHeight: number,
  vw: number,
  vh: number,
): "top" | "bottom" | "left" | "right" {
  const fits: Record<"top" | "bottom" | "left" | "right", boolean> = {
    bottom:
      vh - (target.top + target.height) >=
      cardHeight + CARD_MARGIN + VIEWPORT_PADDING,
    top: target.top >= cardHeight + CARD_MARGIN + VIEWPORT_PADDING,
    right:
      vw - (target.left + target.width) >=
      cardWidth + CARD_MARGIN + VIEWPORT_PADDING,
    left: target.left >= cardWidth + CARD_MARGIN + VIEWPORT_PADDING,
  };

  const order: ("top" | "bottom" | "left" | "right")[] =
    preferred && preferred !== "auto"
      ? [preferred, "bottom", "top", "right", "left"]
      : ["bottom", "top", "right", "left"];

  for (const p of order) {
    if (fits[p]) return p;
  }
  return order[0]!;
}

function computeCardPosition(
  target: Rect | null,
  placement: TutorialPlacement | undefined,
  cardHeight: number,
): { top: number; left: number; width: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const cardWidth = Math.min(CARD_WIDTH, vw - VIEWPORT_PADDING * 2);

  if (!target) {
    return {
      top: Math.max(VIEWPORT_PADDING, (vh - cardHeight) / 2),
      left: Math.max(VIEWPORT_PADDING, (vw - cardWidth) / 2),
      width: cardWidth,
    };
  }

  const actual = pickPlacement(
    placement,
    target,
    cardWidth,
    cardHeight,
    vw,
    vh,
  );

  let top = 0;
  let left = 0;

  if (actual === "bottom") {
    top = target.top + target.height + CARD_MARGIN;
    left = target.left + target.width / 2 - cardWidth / 2;
  } else if (actual === "top") {
    top = target.top - cardHeight - CARD_MARGIN;
    left = target.left + target.width / 2 - cardWidth / 2;
  } else if (actual === "right") {
    top = target.top + target.height / 2 - cardHeight / 2;
    left = target.left + target.width + CARD_MARGIN;
  } else {
    top = target.top + target.height / 2 - cardHeight / 2;
    left = target.left - cardWidth - CARD_MARGIN;
  }

  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(vw - cardWidth - VIEWPORT_PADDING, left),
  );
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(vh - cardHeight - VIEWPORT_PADDING, top),
  );

  return { top, left, width: cardWidth };
}

function Spotlight({ rect }: { rect: Rect }) {
  const padding = 8;
  return (
    <motion.div
      key="spotlight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      aria-hidden
      style={{
        position: "fixed",
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 12,
        boxShadow:
          "0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 0 3px hsl(38 60% 60% / 0.8)",
        pointerEvents: "none",
        zIndex: 60,
      }}
    />
  );
}

function Backdrop() {
  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        pointerEvents: "none",
        zIndex: 60,
      }}
    />
  );
}

function TutorialCard({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onClose,
  onSkipStep,
  onBack,
  onNext,
  onFinish,
}: {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: Rect | null;
  onClose: () => void;
  onSkipStep: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const t = useTranslations("tutorial");
  const [cardHeight, setCardHeight] = useState(0);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!ref) return;
    const measure = () => setCardHeight(ref.offsetHeight);
    measure();
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(ref);
    return () => ro?.disconnect();
  }, [ref]);

  const { top, left, width } = computeCardPosition(
    targetRect,
    step.placement,
    cardHeight || 180,
  );

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <motion.div
      key={`card-${step.id}`}
      ref={setRef}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tutorial-${step.id}-title`}
      style={{
        position: "fixed",
        top,
        left,
        width,
        zIndex: 61,
      }}
    >
      <div className="border-border bg-card text-card-foreground shadow-elevated rounded-lg border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-primary text-xs font-medium tracking-wider uppercase">
              {t("stepCounter", {
                current: stepIndex + 1,
                total: totalSteps,
              })}
            </p>
            <h2
              id={`tutorial-${step.id}-title`}
              className="font-display mt-1 text-xl leading-tight"
            >
              {t(step.titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-1 -mr-1 rounded-md p-1"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {t(step.bodyKey)}
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onSkipStep}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t("skip")}
            </button>
          )}
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={onBack}>
                {t("back")}
              </Button>
            )}
            <Button size="sm" onClick={isLast ? onFinish : onNext}>
              {isLast ? t("finish") : t("next")}
            </Button>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "pointer-events-none mt-3 flex items-center justify-center gap-1.5",
        )}
      >
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === stepIndex
                ? "bg-primary w-6"
                : i < stepIndex
                  ? "bg-primary/60 w-1.5"
                  : "bg-muted-foreground/30 w-1.5",
            )}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function TutorialOverlay() {
  const { steps, dismiss } = useTutorial();
  const isMobile = useIsMobile();
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Gate client-only rendering so the portal contents don't mismatch SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const activeSteps = useMemo(
    () => steps.filter((step) => !(isMobile && step.mobileHidden)),
    [isMobile, steps],
  );
  const currentStep = activeSteps[stepIndex] ?? null;
  const targetSelector =
    isMobile && currentStep?.mobileTargetSelector !== undefined
      ? currentStep.mobileTargetSelector
      : (currentStep?.targetSelector ?? null);
  const targetRect = useTargetRect(targetSelector);

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      if (i >= activeSteps.length - 1) return i;
      return i + 1;
    });
  }, [activeSteps.length]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // ESC exits the tour entirely (matches the X button).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dismiss]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex((i) => Math.min(i, Math.max(activeSteps.length - 1, 0)));
  }, [activeSteps.length]);

  // Auto-advance past a step whose target isn't in the DOM after a short grace
  // window. Mobile has its own step list, so hidden sidebar-only steps are
  // filtered out instead of silently skipped one by one.
  useEffect(() => {
    if (!targetSelector) return;
    if (document.querySelector(targetSelector)) return;
    const id = window.setTimeout(() => {
      if (!document.querySelector(targetSelector)) {
        if (stepIndex >= activeSteps.length - 1) {
          dismiss();
        } else {
          goNext();
        }
      }
    }, MISSING_TARGET_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [targetSelector, stepIndex, activeSteps.length, dismiss, goNext]);

  if (!mounted || !currentStep || typeof document === "undefined") return null;

  const displayStep: TutorialStep = {
    ...currentStep,
    targetSelector,
    bodyKey:
      isMobile && currentStep.mobileBodyKey
        ? currentStep.mobileBodyKey
        : currentStep.bodyKey,
    placement:
      isMobile && currentStep.mobilePlacement
        ? currentStep.mobilePlacement
        : currentStep.placement,
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {targetRect ? (
        <Spotlight key="spotlight" rect={targetRect} />
      ) : (
        <Backdrop key="backdrop" />
      )}
      <TutorialCard
        key={`card-${displayStep.id}`}
        step={displayStep}
        stepIndex={stepIndex}
        totalSteps={activeSteps.length}
        targetRect={targetRect}
        onClose={dismiss}
        onSkipStep={goNext}
        onBack={goBack}
        onNext={goNext}
        onFinish={dismiss}
      />
    </AnimatePresence>,
    document.body,
  );
}
