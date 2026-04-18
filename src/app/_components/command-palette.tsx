"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Star } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/app/_components/command";
import { getPaletteRoutes } from "~/app/_lib/navigation";
import { api } from "~/trpc/react";

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return ctx;
}

type Action = {
  id: string;
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  targetPath: string;
};

const ACTIONS: Action[] = [
  {
    id: "new-transaction",
    titleKey: "commandPalette.actions.newTransaction",
    icon: Plus,
    targetPath: "/transactions?new=1",
  },
  {
    id: "new-account",
    titleKey: "commandPalette.actions.newAccount",
    icon: Plus,
    targetPath: "/accounts?new=1",
  },
  {
    id: "new-challenge",
    titleKey: "commandPalette.actions.newChallenge",
    icon: Plus,
    targetPath: "/budgets/challenges?new=1",
  },
];

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const toggle = React.useCallback(() => setOpen((v) => !v), []);
  const value = React.useMemo(
    () => ({ open, setOpen, toggle }),
    [open, toggle],
  );
  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
}

function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const t = useTranslations();
  const favorites = api.favorite.list.useQuery(undefined, {
    enabled: open,
  });

  const go = React.useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router, setOpen],
  );

  const paletteRoutes = getPaletteRoutes();

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("commandPalette.title")}
      description={t("commandPalette.description")}
    >
      <CommandInput placeholder={t("commandPalette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("commandPalette.empty")}</CommandEmpty>

        {favorites.data && favorites.data.length > 0 && (
          <CommandGroup heading={t("commandPalette.favorites")}>
            {favorites.data.map((fav) => (
              <CommandItem
                key={fav.id}
                value={`fav ${fav.name} ${fav.path}`}
                onSelect={() => go(fav.path)}
              >
                <Star className="text-muted-foreground" />
                <span>{fav.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading={t("commandPalette.navigation")}>
          {paletteRoutes.map((route) => {
            const Icon = route.icon;
            const label = t(route.titleKey);
            return (
              <CommandItem
                key={route.path}
                value={`nav ${label} ${route.path}`}
                onSelect={() => go(route.path)}
              >
                {Icon ? <Icon className="text-muted-foreground" /> : null}
                <span>{label}</span>
                {route.shortcut ? (
                  <CommandShortcut shortcut={route.shortcut} />
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("commandPalette.actions.heading")}>
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const label = t(action.titleKey);
            return (
              <CommandItem
                key={action.id}
                value={`action ${label}`}
                onSelect={() => go(action.targetPath)}
              >
                <Icon className="text-muted-foreground" />
                <span>{label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
