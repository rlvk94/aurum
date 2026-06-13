"use client";

import type { Components } from "react-markdown";
import Markdown from "react-markdown";

import { cn } from "~/app/_lib/utils";

// Styled markdown renderer for legal/terms content. The raw markdown source is
// what we snapshot on acceptance, so rendering is purely presentational.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-foreground text-2xl tracking-tight sm:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display text-foreground mt-8 text-lg tracking-tight sm:text-xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mt-6 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="text-muted-foreground mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="text-foreground font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary hover:text-primary/80 underline underline-offset-2"
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
