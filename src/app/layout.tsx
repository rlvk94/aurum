import "~/app/_styles/globals.css";

import { type Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Aurum",
  description: "Family finance management",
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif-display",
});

// Runs before React hydrates — reads theme cookie and applies `.dark` class
// when the user chose system + the OS prefers dark. Prevents a flash.
const themeSyncScript = `
(function(){try{
  var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);
  var t=m?decodeURIComponent(m[1]):"system";
  var prefersDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark=t==="dark"||(t==="system"&&prefersDark);
  document.documentElement.classList.toggle("dark",isDark);
}catch(_){}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "system";
  const isDark = theme === "dark";

  return (
    <html
      lang={locale}
      className={`${dmSans.variable} ${dmSerifDisplay.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeSyncScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
