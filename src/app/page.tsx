import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSession } from "~/server/better-auth/server";
import { LandingNav } from "~/app/_components/landing/landing-nav";
import { LandingHero } from "~/app/_components/landing/landing-hero";
import { LandingFeatures } from "~/app/_components/landing/landing-features";
import { LandingPricing } from "~/app/_components/landing/landing-pricing";
import { LandingFaq } from "~/app/_components/landing/landing-faq";
import { LandingContact } from "~/app/_components/landing/landing-contact";
import { LandingFooter } from "~/app/_components/landing/landing-footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home() {
  const session = await getSession();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav isAuthed={isAuthed} />
      <main>
        <LandingHero isAuthed={isAuthed} />
        <LandingFeatures />
        <LandingPricing isAuthed={isAuthed} />
        <LandingFaq />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}
