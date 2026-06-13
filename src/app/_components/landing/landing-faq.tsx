"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "~/app/_lib/utils";
import { SectionMarker } from "./section-marker";

type FaqItem = { q: string; a: string };

export function LandingFaq() {
  const t = useTranslations("landing.faq");
  const items = (t.raw("items") as FaqItem[]) ?? [];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <header className="max-w-2xl">
          <SectionMarker>{t("marker")}</SectionMarker>
          <h2 className="font-display text-foreground mt-4 text-4xl leading-tight sm:text-5xl">
            {t("heading")}
          </h2>
        </header>

        <ul className="border-primary/15 mt-12 border-t">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={i} className="border-primary/15 border-b">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="group flex w-full items-baseline gap-6 py-6 text-left transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-display almanac-numerals text-primary/60 group-hover:text-primary shrink-0 text-2xl">
                    Q.
                  </span>
                  <span
                    className={cn(
                      "font-display flex-1 text-xl leading-snug transition-colors sm:text-2xl",
                      isOpen
                        ? "text-primary italic"
                        : "text-foreground group-hover:text-primary italic",
                    )}
                  >
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "font-display shrink-0 text-3xl leading-none transition-all duration-300",
                      isOpen
                        ? "text-primary rotate-45"
                        : "text-muted-foreground group-hover:text-primary",
                    )}
                  >
                    +
                  </span>
                </button>

                <div
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex items-baseline gap-6 pr-12 pb-7">
                      <span className="font-display text-primary/40 shrink-0 text-2xl">
                        A.
                      </span>
                      <p className="text-muted-foreground flex-1 text-base leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
