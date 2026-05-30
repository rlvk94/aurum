// Bundled Terms & Conditions content. Shipped with the codebase and pinned by
// `version`. See the plan / ADR for rationale.
//
// IMPORTANT — audit fidelity:
//   • Each shipped version's text is IMMUTABLE. Never edit the `content` of a
//     version that has already been released — doing so would corrupt the
//     verbatim copies users accepted (we snapshot the exact text on accept).
//   • To change the terms, APPEND a new `TermsVersion` entry with a higher
//     `version` (lexicographically sortable, e.g. an ISO date). The acceptance
//     log (`terms_acceptance`) is append-only and stores one row per
//     (user, version), so multiple versions per user are supported out of the
//     box for a future "re-consent on change" flow.
//
// DRAFT NOTICE: the legal text below is a reasonable starter for a Danish
// family-finance app. It MUST be reviewed by legal counsel before production.

import { type Locale } from "~/i18n/config";

export type TermsVersion = {
  /** Immutable, lexicographically sortable version id (ISO date). */
  version: string;
  /** ISO date the version takes effect (visible when effectiveDate <= now). */
  effectiveDate: string;
  /** Full markdown text per locale. */
  content: Record<Locale, string>;
};

const DA_2026_05_30 = `# Vilkår og betingelser

_Senest opdateret: 30. maj 2026_

Velkommen til Aurum. Disse vilkår og betingelser ("Vilkårene") regulerer din brug af Aurum-applikationen og de tilhørende tjenester ("Tjenesten"). Ved at oprette en konto og acceptere disse Vilkår indgår du en bindende aftale med os. Læs dem grundigt.

## 1. Accept af Vilkårene

Når du opretter en konto, bliver du bedt om aktivt at acceptere disse Vilkår. Du kan ikke bruge Tjenesten uden at acceptere. Vi gemmer en kopi af den nøjagtige tekst, du accepterede, samt tidspunktet for din accept, til dokumentationsformål.

## 2. Om Tjenesten

Aurum er et værktøj til personlig og fælles familieøkonomi. Tjenesten hjælper dig med manuelt at registrere konti, transaktioner, budgetter, gæld, aktiver og opsparingsmål samt at beregne din formue.

Aurum har **ingen** integration til banker eller betalingstjenester. Alle finansielle data indtastes manuelt eller importeres via CSV. Aurum flytter ikke rigtige penge og gennemfører ikke betalinger.

## 3. Ingen finansiel rådgivning

Aurum leverer udelukkende værktøjer til at organisere dine egne data. Indholdet i Tjenesten udgør ikke finansiel, juridisk eller skattemæssig rådgivning. Du er selv ansvarlig for rigtigheden af de data, du indtaster, og for de beslutninger, du træffer på baggrund af dem.

## 4. Din konto og din familie

Login sker via en engangskode (OTP) sendt til din e-mail. Du er ansvarlig for at holde adgangen til din e-mail sikker. En familie er et delt arbejdsrum: medlemmer af en familie kan se og redigere familiens finansielle data. Inviter kun personer, du stoler på, og del kun data, du har ret til at dele.

## 5. Data og privatliv

Vi behandler dine personoplysninger i overensstemmelse med gældende databeskyttelseslovgivning (GDPR). Vi anvender PostHog (EU) til produktanalyse og fejlovervågning. Du kan til enhver tid anmode om indsigt i, berigtigelse af eller sletning af dine data ved at kontakte os.

## 6. Acceptabel brug

Du må ikke misbruge Tjenesten, herunder forsøge at få uautoriseret adgang, forstyrre driften eller bruge Tjenesten til ulovlige formål.

## 7. Abonnement og betaling

Dele af Tjenesten kræver et betalt abonnement. Betaling håndteres af Stripe. Priser, planer og betalingsbetingelser fremgår i appen og kan ændre sig. Ved manglende betaling kan adgangen til betalte funktioner blive begrænset.

## 8. Ændringer af disse Vilkår

**Vi kan til enhver tid ændre disse Vilkår.** Når vi udgiver en væsentligt ændret version, kan vi bede dig om at acceptere den opdaterede version, før du fortsætter med at bruge Tjenesten, og/eller underrette dig via appen eller e-mail. Din fortsatte brug af Tjenesten efter ikrafttrædelsen af ændrede Vilkår udgør din accept af dem. Den til enhver tid gældende version er altid tilgængelig i appen.

## 9. Ansvarsfraskrivelse

Tjenesten leveres "som den er og forefindes". I det omfang loven tillader det, fraskriver vi os ethvert ansvar for tab, der opstår som følge af din brug af Tjenesten, herunder tab som følge af unøjagtige data, du selv har indtastet.

## 10. Ophør

Du kan til enhver tid lukke din konto. Vi kan suspendere eller lukke din adgang, hvis du overtræder disse Vilkår.

## 11. Lovvalg

Disse Vilkår er underlagt dansk ret, og eventuelle tvister afgøres ved de danske domstole.

## 12. Kontakt

Har du spørgsmål til disse Vilkår, kan du kontakte os via appens kontaktformular.`;

const EN_2026_05_30 = `# Terms & Conditions

_Last updated: 30 May 2026_

Welcome to Aurum. These terms and conditions (the "Terms") govern your use of the Aurum application and related services (the "Service"). By creating an account and accepting these Terms, you enter into a binding agreement with us. Please read them carefully.

## 1. Acceptance of the Terms

When you create an account, you are asked to actively accept these Terms. You cannot use the Service without accepting them. We store a copy of the exact text you accepted, together with the time of your acceptance, for documentation purposes.

## 2. About the Service

Aurum is a tool for personal and shared family finance. The Service helps you manually track accounts, transactions, budgets, debts, assets and savings goals, and calculate your net worth.

Aurum has **no** integration with banks or payment providers. All financial data is entered manually or imported via CSV. Aurum does not move real money and does not make payments.

## 3. No financial advice

Aurum provides tools to organise your own data only. Nothing in the Service constitutes financial, legal or tax advice. You are responsible for the accuracy of the data you enter and for any decisions you make based on it.

## 4. Your account and your family

Sign-in uses a one-time code (OTP) sent to your email. You are responsible for keeping access to your email secure. A family is a shared workspace: members of a family can view and edit that family's financial data. Only invite people you trust, and only share data you are entitled to share.

## 5. Data and privacy

We process your personal data in accordance with applicable data protection law (GDPR). We use PostHog (EU) for product analytics and error monitoring. You may at any time request access to, correction of, or deletion of your data by contacting us.

## 6. Acceptable use

You must not misuse the Service, including attempting to gain unauthorised access, disrupting its operation, or using it for unlawful purposes.

## 7. Subscriptions and billing

Parts of the Service require a paid subscription. Payments are handled by Stripe. Prices, plans and payment terms are shown in the app and may change. If payment fails, access to paid features may be restricted.

## 8. Changes to these Terms

**We may change these Terms at any time.** When we release a materially changed version, we may ask you to accept the updated version before you continue using the Service, and/or notify you via the app or email. Your continued use of the Service after changed Terms take effect constitutes your acceptance of them. The current version is always available in the app.

## 9. Disclaimer of liability

The Service is provided "as is" and "as available". To the extent permitted by law, we disclaim all liability for any loss arising from your use of the Service, including loss resulting from inaccurate data you entered yourself.

## 10. Termination

You may close your account at any time. We may suspend or terminate your access if you breach these Terms.

## 11. Governing law

These Terms are governed by Danish law, and any disputes are subject to the Danish courts.

## 12. Contact

If you have questions about these Terms, you can contact us via the contact form in the app.`;

// Ordered oldest → newest. Append new versions at the end.
export const TERMS_VERSIONS: ReadonlyArray<TermsVersion> = [
  {
    version: "2026-05-30",
    effectiveDate: "2026-05-30",
    content: {
      da: DA_2026_05_30,
      en: EN_2026_05_30,
    },
  },
];

/** The latest version whose effectiveDate is on or before `now`. */
export function getCurrentTerms(now: Date = new Date()): TermsVersion {
  const today = now.toISOString().slice(0, 10);
  const effective = TERMS_VERSIONS.filter((t) => t.effectiveDate <= today);
  const pool = effective.length > 0 ? effective : TERMS_VERSIONS;
  return pool.reduce((latest, t) => (t.version > latest.version ? t : latest));
}

export function getTermsByVersion(version: string): TermsVersion | undefined {
  return TERMS_VERSIONS.find((t) => t.version === version);
}
