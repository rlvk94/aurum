"use client";

/**
 * Module-level pub/sub for the global upgrade modal so non-React code
 * (e.g. the tRPC error link) can trigger it without holding a context handle.
 *
 * The provider in `upgrade-modal.tsx` registers itself as the listener on
 * mount; everywhere else just calls `openUpgradeModal()`.
 */

type Listener = (feature?: string) => void;

let listener: Listener | null = null;

export function setUpgradeModalListener(next: Listener | null) {
  listener = next;
}

export function openUpgradeModal(feature?: string) {
  listener?.(feature);
}
