"use client";

import * as React from "react";

export type PageMetadata = {
  /** Display title for the current leaf (e.g. "Checking Account"). */
  title: string;
  /** Parent path used to build the breadcrumb chain (e.g. "/accounts"). */
  parentPath?: string;
};

type PageMetadataContextValue = {
  metadata: PageMetadata | null;
  setMetadata: (m: PageMetadata | null) => void;
};

const PageMetadataContext =
  React.createContext<PageMetadataContextValue | null>(null);

export function PageMetadataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [metadata, setMetadata] = React.useState<PageMetadata | null>(null);

  // Stale metadata is cleared by `usePageMetadata`'s cleanup on unmount —
  // we intentionally don't reset on pathname change here, since a parent
  // effect running after a child's `setMetadata` would wipe the new value.
  const value = React.useMemo(
    () => ({ metadata, setMetadata }),
    [metadata],
  );

  return (
    <PageMetadataContext.Provider value={value}>
      {children}
    </PageMetadataContext.Provider>
  );
}

/** Read the current page's metadata. Safe to call outside the provider. */
export function usePageMetadataValue(): PageMetadata | null {
  return React.useContext(PageMetadataContext)?.metadata ?? null;
}

/**
 * Register metadata for the current page (title + breadcrumb parent).
 * Call with `null` to clear manually; otherwise unmount/path-change does it.
 */
export function usePageMetadata(metadata: PageMetadata | null) {
  const ctx = React.useContext(PageMetadataContext);
  // `setMetadata` from useState is referentially stable — depending on the
  // whole `ctx` object would loop, since the context value is re-memoized
  // every time the metadata state changes.
  const setMetadata = ctx?.setMetadata;
  const title = metadata?.title ?? null;
  const parentPath = metadata?.parentPath ?? null;

  React.useEffect(() => {
    if (!setMetadata) return;
    if (title === null) {
      setMetadata(null);
      return;
    }
    setMetadata({ title, parentPath: parentPath ?? undefined });
    return () => setMetadata(null);
  }, [setMetadata, title, parentPath]);
}
