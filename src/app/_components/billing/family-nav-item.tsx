"use client";

import Link from "next/link";

import {
  SidebarMenuButton,
  SidebarMenuSubButton,
} from "~/app/_components/sidebar";
import { LockBadge } from "~/app/_components/billing/lock-badge";
import { useUpgradeModal } from "~/app/_components/billing/upgrade-modal";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import type { BooleanFeatureKey } from "~/server/billing/plans";

type Props = {
  feature: BooleanFeatureKey;
  href: string;
  isActive: boolean;
  icon?: React.ReactNode;
  label: string;
};

/**
 * Top-level sidebar entry for a Family-only feature. When the family has
 * the feature, behaves as a normal Link. When not, renders the same row but
 * intercepts clicks to open the upgrade modal and shows a lock badge.
 */
export function FamilyNavItem({ feature, href, isActive, icon, label }: Props) {
  const { has } = useEntitlements();
  const upgrade = useUpgradeModal();

  if (has(feature)) {
    return (
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton
      onClick={() => upgrade.open(feature)}
      className="opacity-80"
    >
      {icon}
      <span className="flex flex-1 items-center justify-between gap-2">
        <span>{label}</span>
        <LockBadge />
      </span>
    </SidebarMenuButton>
  );
}

/**
 * Sub-item variant for collapsible sub-menus (e.g. Budgets → Annual).
 */
export function FamilySubNavItem({
  feature,
  href,
  isActive,
  label,
}: Omit<Props, "icon">) {
  const { has } = useEntitlements();
  const upgrade = useUpgradeModal();

  if (has(feature)) {
    return (
      <SidebarMenuSubButton asChild isActive={isActive}>
        <Link href={href}>{label}</Link>
      </SidebarMenuSubButton>
    );
  }

  return (
    <SidebarMenuSubButton
      onClick={() => upgrade.open(feature)}
      className="cursor-pointer opacity-80"
    >
      <span className="flex flex-1 items-center justify-between gap-2">
        <span>{label}</span>
        <LockBadge />
      </span>
    </SidebarMenuSubButton>
  );
}
