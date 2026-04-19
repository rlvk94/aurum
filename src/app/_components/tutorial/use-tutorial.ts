"use client";

import { useContext } from "react";

import { TutorialContext } from "./tutorial-context";

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within a <TutorialProvider>");
  }
  return ctx;
}
