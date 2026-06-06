"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/app/_components/breadcrumb";
import { CommandLauncherButton } from "~/app/_components/command-launcher-button";
import { FavoriteStarButton } from "~/app/_components/favorite-star-button";
import { usePageMetadataValue } from "~/app/_components/page-metadata";
import { buildBreadcrumb } from "~/app/_lib/navigation";
import { cn } from "~/app/_lib/utils";

type Crumb = {
  key: string;
  label: string;
  href?: string;
};

export function TopNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const metadata = usePageMetadataValue();

  let crumbs: Crumb[];

  // Only apply metadata when the current path is a proper descendant of its
  // declared parent — otherwise we're seeing stale state from a previous
  // detail page (React renders the new page before the old one unmounts).
  const metadataApplies =
    metadata?.title !== undefined &&
    (!metadata.parentPath ||
      pathname.startsWith(`${metadata.parentPath}/`));

  if (metadataApplies && metadata) {
    // Dynamic leaf: page registered its own title.
    const parentChain = metadata.parentPath
      ? buildBreadcrumb(metadata.parentPath)
      : [];
    crumbs = [
      ...parentChain.map((r) => ({
        key: r.path,
        label: t(r.titleKey),
        href: r.path,
      })),
      { key: pathname, label: metadata.title },
    ];
  } else {
    crumbs = buildBreadcrumb(pathname).map((r, i, arr) => ({
      key: r.path,
      label: t(r.titleKey),
      href: i === arr.length - 1 ? undefined : r.path,
    }));
  }

  return (
    <div className="flex flex-1 items-center gap-2 sm:gap-4">
      <Breadcrumb className="hidden min-w-0 flex-1 md:block">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            const isIntermediate = !isLast && i > 0;
            return (
              <React.Fragment key={crumb.key}>
                <BreadcrumbItem
                  className={cn(
                    "min-w-0",
                    isIntermediate && "hidden sm:inline-flex",
                  )}
                >
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="block truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={crumb.href}
                        className="block max-w-[10rem] truncate sm:max-w-none"
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator
                    className={cn(isIntermediate && "hidden sm:inline-flex")}
                  />
                )}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
        <FavoriteStarButton />
        <CommandLauncherButton />
      </div>
    </div>
  );
}
