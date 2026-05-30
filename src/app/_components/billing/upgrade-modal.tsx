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
import { Check, Lock } from "lucide-react";

import { setUpgradeModalListener } from "./upgrade-modal-bus";

import { api } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { cn } from "~/app/_lib/utils";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";

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
  const isMobile = useIsMobile();

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

  const goToBilling = () => {
    onOpenChange(false);
    router.push("/settings/billing");
  };

  // Hero — Family-plan banner. `bleed` cancels the host container's own
  // padding so the banner touches the edges (Dialog has padding; the Drawer
  // body does not, so it passes an empty string).
  const hero = (bleed: string) => (
    <div
      className={cn(
        "bg-primary/5 border-border/60 border-b px-6 pt-6 pb-5",
        bleed,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="bg-primary/10 text-primary border-primary/20 inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
        >
          <Lock className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-[1.65rem]">
            {t("hero.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>
    </div>
  );

  const detail = (
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
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] overflow-hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{featureTitle ?? t("title")}</DrawerTitle>
          </DrawerHeader>
          {/* Pull up over the drag-handle strip so the hero fills to the very
              top edge; extra top padding keeps the text clear of the handle. */}
          <div className="-mt-6 overflow-y-auto">
            {hero("rounded-t-[10px] pt-8")}
            <div className="px-4 pt-4 pb-2">{detail}</div>
          </div>
          {!isMember && (
            <DrawerFooter>
              <Button onClick={goToBilling}>{t("cta")}</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="overflow-hidden sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{featureTitle ?? t("title")}</DialogTitle>
        </DialogHeader>

        {hero("-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 sm:px-7")}

        {detail}

        {!isMember && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={goToBilling}>{t("cta")}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
