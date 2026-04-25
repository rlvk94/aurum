import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { SectionMarker } from "./section-marker";

export function LandingHero({ isAuthed }: { isAuthed: boolean }) {
  const t = useTranslations("landing.hero");

  return (
    <section className="almanac-grain relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 pt-20 pb-24 lg:grid-cols-[1.35fr_1fr] lg:gap-12 lg:pt-32 lg:pb-32 lg:min-h-[calc(100svh-4rem)]">
        {/* Left column — editorial copy stack */}
        <div className="relative">
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {t("headlineLead")}{" "}
            <em className="not-italic">
              <span className="font-display italic text-primary">{t("headlineEm")}</span>
            </em>
            {t("headlineTrail")}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
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
            className="pointer-events-none absolute -left-6 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent lg:block"
          />

          {/* Back card — peeking transaction row */}
          <div className="absolute right-0 top-0 w-[78%] rotate-[1.5deg] rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <SectionMarker>{t("demo.txnTitle")}</SectionMarker>
              <span className="almanac-numerals text-[10px] tracking-tight text-muted-foreground">
                {t("demo.backDate")}
              </span>
            </div>
            <div className="almanac-rule mt-3" />
            <ul className="mt-3 space-y-3">
              <li className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-foreground">{t("demo.txnRow1Name")}</div>
                  <div className="almanac-smallcaps mt-0.5 text-[9px] tracking-[0.18em] text-muted-foreground">
                    {t("demo.txnRow1Cat")}
                  </div>
                </div>
                <div className="almanac-numerals font-display text-base text-foreground">
                  {t("demo.txnRow1Amount")}
                </div>
              </li>
              <li className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-foreground">{t("demo.txnRow2Name")}</div>
                  <div className="almanac-smallcaps mt-0.5 text-[9px] tracking-[0.18em] text-income">
                    {t("demo.txnRow2Cat")}
                  </div>
                </div>
                <div className="almanac-numerals font-display text-base text-income">
                  {t("demo.txnRow2Amount")}
                </div>
              </li>
            </ul>
          </div>

          {/* Front card — budget fragment */}
          <div className="absolute bottom-4 left-0 w-[82%] -rotate-[2deg] rounded-lg border border-border bg-card p-5 shadow-elevated">
            <div className="flex items-baseline justify-between">
              <SectionMarker>{t("demo.budgetTitle")}</SectionMarker>
              <span className="almanac-smallcaps text-[10px] tracking-[0.18em] text-warning">
                {t("demo.budgetDelta")}
              </span>
            </div>

            <div className="mt-3 font-display text-xl text-foreground">
              {t("demo.budgetCategory")}
            </div>

            <div className="almanac-numerals mt-2 flex items-baseline gap-2">
              <span className="font-display text-3xl text-foreground">
                {t("demo.budgetSpent")}
              </span>
              <span className="text-sm text-muted-foreground">{t("demo.budgetPlanned")}</span>
            </div>

            {/* Mini progress */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-(--expense-muted)">
              <div className="h-full rounded-full bg-warning" style={{ width: "79%" }} />
            </div>

            <div className="almanac-smallcaps mt-3 text-[10px] tracking-[0.18em] text-muted-foreground">
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
        <span className="almanac-smallcaps text-[9px] tracking-[0.32em] text-muted-foreground transition-colors group-hover:text-primary">
          {t("scroll")}
        </span>
        <div className="relative h-12 w-px overflow-hidden bg-primary/20">
          <div
            aria-hidden
            className="absolute left-0 top-0 h-3 w-full bg-primary"
            style={{ animation: "almanac-scroll-dot 2.4s ease-in-out infinite" }}
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
