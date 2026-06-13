import { type Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentTerms } from "~/server/terms";
import { TermsContent } from "~/app/_components/terms-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("pageTitle") };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations("terms");
  const terms = getCurrentTerms();
  const content =
    terms.content[locale === "en" ? "en" : "da"] ?? terms.content.da;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("backToHome")}
        </Link>

        <article className="mt-8">
          <TermsContent content={content} />
        </article>
      </div>
    </div>
  );
}
