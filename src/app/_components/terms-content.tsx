"use client";

import type { Components } from "react-markdown";
import Markdown from "react-markdown";

import { cn } from "~/app/_lib/utils";

// Styled markdown renderer for legal/terms content. The raw markdown source is
// what we snapshot on acceptance, so rendering is purely presentational.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 font-display text-lg tracking-tight text-foreground sm:text-xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
};

export function TermsContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <Markdown components={components}>{content}</Markdown>
    </div>
  );
}
