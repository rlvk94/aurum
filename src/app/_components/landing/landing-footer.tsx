import Link from "next/link";
import { useTranslations } from "next-intl";
import { SectionMarker } from "./section-marker";

export function LandingFooter() {
  const t = useTranslations("landing.footer");

  const map = [
    { href: "#features", label: t("links.features") },
    { href: "#pricing", label: t("links.pricing") },
    { href: "#faq", label: t("links.faq") },
    { href: "#contact", label: t("links.contact") },
    { href: "/terms", label: t("links.terms") },
  ];

  return (
    <footer className="relative border-t border-primary/15 pt-16 pb-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-12 md:flex-row md:items-start md:justify-center md:gap-24">
          <div className="text-center md:max-w-sm md:text-left">
            <SectionMarker>§ Aurum</SectionMarker>
            <div className="mt-3 font-display text-2xl text-foreground">Aurum</div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          <nav aria-label={t("mapTitle")} className="text-center md:text-left">
            <SectionMarker>{t("mapTitle")}</SectionMarker>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm md:flex-col md:justify-start md:gap-y-2">
              {map.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="almanac-rule mt-12" />

        <p className="almanac-smallcaps mt-6 text-center text-[10px] tracking-[0.28em] text-muted-foreground">
          {t("colophon")}
        </p>
      </div>
    </footer>
  );
}
