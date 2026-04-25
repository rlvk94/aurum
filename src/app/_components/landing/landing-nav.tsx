"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { cn } from "~/app/_lib/utils";

const SECTIONS = ["features", "pricing", "faq", "contact"] as const;
type SectionId = (typeof SECTIONS)[number];

export function LandingNav({ isAuthed }: { isAuthed: boolean }) {
  const t = useTranslations("landing.nav");
  const [active, setActive] = useState<SectionId | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observerRef.current = observer;
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors",
        scrolled
          ? "bg-background/85 backdrop-blur-md border-b border-primary/15"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-foreground"
        >
          Aurum
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={cn(
                  "almanac-smallcaps relative text-[10px] tracking-[0.22em] transition-colors",
                  active === id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(id)}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-1.5 left-0 h-px bg-primary transition-all duration-300",
                    active === id ? "w-full" : "w-0",
                  )}
                />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Button asChild size="sm" className="rounded-md">
              <Link href="/dashboard">{t("goToApp")} →</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm" className="rounded-md">
                <Link href="/login">{t("getStarted")}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
