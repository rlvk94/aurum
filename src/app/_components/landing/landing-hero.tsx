import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { SectionMarker } from "./section-marker";

export function LandingHero({ isAuthed }: { isAuthed: boolean }) {
  const t = useTranslations("landing.hero");

  return (
    <section className="almanac-grain relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 pt-20 pb-24 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.35fr_1fr] lg:gap-12 lg:pt-32 lg:pb-32">
        {/* Left column — editorial copy stack */}
        <div className="relative">
          <h1 className="font-display text-foreground text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            {t("headlineLead")}{" "}
            <em className="not-italic">
              <span className="font-display text-primary italic">
                {t("headlineEm")}
              </span>
            </em>
            {t("headlineTrail")}
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
            {t("subhead")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthed ? (
              <Button asChild size="lg">
                <Link href="/dashboard">{t("ctaAuthed")} →</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/login">{t("ctaPrimary")}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/login">{t("ctaSecondary")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Right column — layered product fragment */}
        <div className="relative h-[480px]">
          {/* Decorative gold rule between columns */}
          <div
            aria-hidden
            className="via-primary/20 pointer-events-none absolute top-0 -left-6 hidden h-full w-px bg-gradient-to-b from-transparent to-transparent lg:block"
          />

          {/* Back card — peeking transaction row */}
          <div className="border-border bg-card shadow-card absolute top-0 right-0 w-[78%] rotate-[1.5deg] rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <SectionMarker>{t("demo.txnTitle")}</SectionMarker>
              <span className="almanac-numerals text-muted-foreground text-[10px] tracking-tight">
                {t("demo.backDate")}
              </span>
            </div>
            <div className="almanac-rule mt-3" />
            <ul className="mt-3 space-y-3">
              <li className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground font-medium">
                    {t("demo.txnRow1Name")}
                  </div>
                  <div className="almanac-smallcaps text-muted-foreground mt-0.5 text-[9px] tracking-[0.18em]">
                    {t("demo.txnRow1Cat")}
                  </div>
                </div>
                <div className="almanac-numerals font-display text-foreground text-base">
                  {t("demo.txnRow1Amount")}
                </div>
              </li>
              <li className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground font-medium">
                    {t("demo.txnRow2Name")}
                  </div>
                  <div className="almanac-smallcaps text-income mt-0.5 text-[9px] tracking-[0.18em]">
                    {t("demo.txnRow2Cat")}
                  </div>
                </div>
                <div className="almanac-numerals font-display text-income text-base">
                  {t("demo.txnRow2Amount")}
                </div>
              </li>
            </ul>
          </div>

          {/* Front card — budget fragment */}
          <div className="border-border bg-card shadow-elevated absolute bottom-4 left-0 w-[82%] -rotate-[2deg] rounded-lg border p-5">
            <div className="flex items-baseline justify-between">
              <SectionMarker>{t("demo.budgetTitle")}</SectionMarker>
              <span className="almanac-smallcaps text-warning text-[10px] tracking-[0.18em]">
                {t("demo.budgetDelta")}
              </span>
            </div>

            <div className="font-display text-foreground mt-3 text-xl">
              {t("demo.budgetCategory")}
            </div>

            <div className="almanac-numerals mt-2 flex items-baseline gap-2">
              <span className="font-display text-foreground text-3xl">
                {t("demo.budgetSpent")}
              </span>
              <span className="text-muted-foreground text-sm">
                {t("demo.budgetPlanned")}
              </span>
            </div>

            {/* Mini progress */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-(--expense-muted)">
              <div
                className="bg-warning h-full rounded-full"
                style={{ width: "79%" }}
              />
            </div>

            <div className="almanac-smallcaps text-muted-foreground mt-3 text-[10px] tracking-[0.18em]">
              {t("demo.budgetCaption")}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#features"
        aria-label="Scroll to features"
        className="group absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex"
      >
        <span className="almanac-smallcaps text-muted-foreground group-hover:text-primary text-[9px] tracking-[0.32em] transition-colors">
          {t("scroll")}
        </span>
        <div className="bg-primary/20 relative h-12 w-px overflow-hidden">
          <div
            aria-hidden
            className="bg-primary absolute top-0 left-0 h-3 w-full"
            style={{
              animation: "almanac-scroll-dot 2.4s ease-in-out infinite",
            }}
          />
        </div>
      </a>

      {/* Bottom hairline transition */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="almanac-rule" />
      </div>
    </section>
  );
}
