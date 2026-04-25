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
          <h2 className="mt-4 font-display text-4xl leading-tight text-foreground sm:text-5xl">
            {t("heading")}
          </h2>
        </header>

        <ul className="mt-12 border-t border-primary/15">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={i} className="border-b border-primary/15">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="group flex w-full items-baseline gap-6 py-6 text-left transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-display almanac-numerals shrink-0 text-2xl text-primary/60 group-hover:text-primary">
                    Q.
                  </span>
                  <span
                    className={cn(
                      "flex-1 font-display text-xl leading-snug transition-colors sm:text-2xl",
                      isOpen ? "text-primary italic" : "text-foreground italic group-hover:text-primary",
                    )}
                  >
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "font-display shrink-0 text-3xl leading-none transition-all duration-300",
                      isOpen
                        ? "rotate-45 text-primary"
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
                    <div className="flex items-baseline gap-6 pb-7 pr-12">
                      <span className="font-display shrink-0 text-2xl text-primary/40">
                        A.
                      </span>
                      <p className="flex-1 text-base leading-relaxed text-muted-foreground">
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
