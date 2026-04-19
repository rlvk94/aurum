"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { api } from "~/trpc/react";

import { TutorialContext, type TutorialContextValue } from "./tutorial-context";
import { TutorialOverlay } from "./tutorial-overlay";
import { TUTORIAL_STEPS } from "./tutorial-steps";

const DASHBOARD_PATH = "/dashboard";

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const utils = api.useUtils();
  const { data: me } = api.user.me.useQuery();

  // `closedByUser` is a one-way latch set by skip/finish. It prevents the
  // overlay from re-appearing in the brief window between the dismiss click
  // and the `user.me` refetch that clears `eligible`. If the mutation fails
  // we reset the latch so the user can try again on their next dashboard
  // visit.
  const [closedByUser, setClosedByUser] = useState(false);

  const dismissMutation = api.user.dismissTutorial.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
    },
    onError: () => {
      setClosedByUser(false);
    },
  });

  const eligible = !!me?.onboardedAt && me.tutorialCompletedAt === null;
  const isActive = eligible && !closedByUser && pathname === DASHBOARD_PATH;

  const dismiss = useCallback(() => {
    setClosedByUser(true);
    dismissMutation.mutate();
  }, [dismissMutation]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      isActive,
      steps: TUTORIAL_STEPS,
      dismiss,
    }),
    [isActive, dismiss],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {isActive && <TutorialOverlay />}
    </TutorialContext.Provider>
  );
}
