"use client";

import { createContext } from "react";

import type { TutorialStep } from "./tutorial-steps";

export type TutorialContextValue = {
  isActive: boolean;
  steps: readonly TutorialStep[];
  dismiss: () => void;
};

export const TutorialContext = createContext<TutorialContextValue | null>(null);
