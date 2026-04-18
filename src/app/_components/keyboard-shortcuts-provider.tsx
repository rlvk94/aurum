"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useCommandPalette } from "~/app/_components/command-palette";
import { useSidebar } from "~/app/_components/sidebar";
import { findRoute, getPaletteRoutes } from "~/app/_lib/navigation";
import { api } from "~/trpc/react";

const CHORD_TIMEOUT_MS = 1000;

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggle: togglePalette, setOpen: setPaletteOpen } =
    useCommandPalette();
  const { toggleSidebar } = useSidebar();

  const utils = api.useUtils();
  const toggleFavorite = api.favorite.toggle.useMutation({
    onSuccess: () => {
      void utils.favorite.list.invalidate();
    },
  });

  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    const shortcutMap = new Map<string, string>();
    for (const route of getPaletteRoutes()) {
      if (!route.shortcut) continue;
      const parts = route.shortcut.toLowerCase().split(/\s+/);
      if (parts.length === 2 && parts[0] === "g") {
        shortcutMap.set(parts[1]!, route.path);
      }
    }

    let chordActive = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    const clearChord = () => {
      chordActive = false;
      if (chordTimer) {
        clearTimeout(chordTimer);
        chordTimer = null;
      }
    };

    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // ⌘K / Ctrl+K — open command palette (always, even in inputs)
      if (isMod && key === "k") {
        event.preventDefault();
        togglePalette();
        clearChord();
        return;
      }

      // ⌘B / Ctrl+B — toggle sidebar (always)
      if (isMod && key === "b") {
        event.preventDefault();
        toggleSidebar();
        clearChord();
        return;
      }

      // ⌘, / Ctrl+, — go to settings (always)
      if (isMod && event.key === ",") {
        event.preventDefault();
        setPaletteOpen(false);
        router.push("/settings");
        clearChord();
        return;
      }

      // Everything below requires we're NOT in an input
      if (isTypingInField(event.target)) {
        clearChord();
        return;
      }

      // Ignore keys with modifiers for single-key + chord shortcuts
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (chordActive) {
        // Second key of a chord
        const target = shortcutMap.get(key);
        clearChord();
        if (target) {
          event.preventDefault();
          setPaletteOpen(false);
          router.push(target);
        }
        return;
      }

      // Start a "g" chord
      if (key === "g") {
        event.preventDefault();
        chordActive = true;
        chordTimer = setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      // `f` — toggle favorite on current page
      if (key === "f") {
        const route = findRoute(pathRef.current);
        if (!route) return;
        event.preventDefault();
        const docTitle = document.title?.split(" · ")[0]?.trim();
        const name =
          docTitle && docTitle.length > 0
            ? docTitle
            : (route.titleKey.split(".").pop() ?? route.path);
        toggleFavorite.mutate({ name, path: pathRef.current });
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, setPaletteOpen, togglePalette, toggleSidebar, toggleFavorite]);

  return <>{children}</>;
}
