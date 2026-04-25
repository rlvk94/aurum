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

import { setUpgradeModalListener } from "./upgrade-modal-bus";

import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      <UpgradeModal
        open={isOpen}
        feature={feature}
        onOpenChange={setIsOpen}
      />
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

  // Feature-specific title/body when available; fall back to generic copy.
  const tryFeatureKey = (suffix: "title" | "body"): string | null => {
    if (!feature) return null;
    try {
      return tFeature(`${feature}.${suffix}`);
    } catch {
      return null;
    }
  };
  const title = tryFeatureKey("title") ?? t("title");
  const body = tryFeatureKey("body") ?? t("body");

  const cancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={cancel}>
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
      </DialogContent>
    </Dialog>
  );
}
