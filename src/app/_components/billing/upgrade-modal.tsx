"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";

import { setUpgradeModalListener } from "./upgrade-modal-bus";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";

type UpgradeContextValue = {
  open: (feature?: string) => void;
  close: () => void;
};

const UpgradeModalContext = createContext<UpgradeContextValue | null>(null);

export function useUpgradeModal(): UpgradeContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) {
    throw new Error(
      "useUpgradeModal must be called inside <UpgradeModalProvider>",
    );
  }
  return ctx;
}

/**
 * Single global upgrade modal mounted high in the tree. Any descendant can
 * call `useUpgradeModal().open(feature)` to surface it — used by nav badges,
 * locked CTAs, and the global tRPC interceptor for `plan_upgrade_required`.
 */
export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<string | undefined>(undefined);

  const open = useCallback((f?: string) => {
    setFeature(f);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<UpgradeContextValue>(
    () => ({ open, close }),
    [open, close],
  );

  // Bridge the module-level bus so non-React callers (tRPC error link) can
  // trigger the same modal.
  useEffect(() => {
    setUpgradeModalListener(open);
    return () => setUpgradeModalListener(null);
  }, [open]);

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <UpgradeModal open={isOpen} feature={feature} onOpenChange={setIsOpen} />
    </UpgradeModalContext.Provider>
  );
}

type Props = {
  open: boolean;
  feature?: string;
  onOpenChange: (open: boolean) => void;
};

export function UpgradeModal({ open, feature, onOpenChange }: Props) {
  const t = useTranslations("billing.upgradeModal");
  const tFeature = useTranslations("billing.featureCopy");
  const router = useRouter();

  const { data: family } = api.family.current.useQuery(undefined, {
    staleTime: 60 * 1000,
  });
  // Treat unknown role as owner so the CTA is shown by default while the
  // query resolves — most users are owners, and family.current is usually
  // already prefetched at the layout level.
  const isMember = family?.role === "member";

  const tryFeatureKey = (suffix: "title" | "body"): string | null => {
    if (!feature) return null;
    try {
      return tFeature(`${feature}.${suffix}`);
    } catch {
      return null;
    }
  };
  const featureTitle = tryFeatureKey("title");
  const featureBody = tryFeatureKey("body");

  const bullets = (() => {
    if (!feature) return [] as string[];
    try {
      const raw = tFeature.raw(`${feature}.bullets`);
      return Array.isArray(raw) ? (raw as string[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="overflow-hidden sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{featureTitle ?? t("title")}</DialogTitle>
        </DialogHeader>

        {/* Hero — full-bleed Family-plan banner. Negative margins cancel the
            DialogContent's own padding so it touches the dialog edges. */}
        <div className="from-primary/15 border-primary/20 via-primary/5 relative -mx-4 -mt-4 overflow-hidden border-b bg-gradient-to-br to-transparent px-6 pt-6 pb-5 sm:-mx-6 sm:-mt-6 sm:px-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle, hsl(38 60% 50% / 0.35), transparent 70%)",
            }}
          />
          <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide uppercase">
            <Sparkles aria-hidden className="size-3.5" />
            {t("hero.eyebrow")}
          </span>
          <h2 className="font-display text-foreground mt-2.5 text-2xl leading-tight tracking-tight sm:text-[1.65rem]">
            {t("hero.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Feature detail — uses DialogContent's default padding */}
        <div>
          {featureTitle && (
            <h3 className="font-display text-foreground text-lg font-semibold">
              {featureTitle}
            </h3>
          )}
          {featureBody && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {featureBody}
            </p>
          )}

          {bullets.length > 0 && (
            <ul className="text-foreground/90 mt-4 space-y-2.5 text-sm">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="bg-primary/15 text-primary mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {isMember && (
            <p className="border-border bg-muted/40 text-muted-foreground mt-5 rounded-md border px-4 py-3 text-sm leading-relaxed">
              {t("memberNote")}
            </p>
          )}
        </div>

        {!isMember && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push("/settings/billing");
              }}
            >
              {t("cta")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
