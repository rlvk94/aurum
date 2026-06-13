import "~/app/_styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Aurum",
  description: "Family finance management",
  applicationName: "Aurum",
  appleWebApp: {
    capable: true,
    title: "Aurum",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
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

// iOS launch images. iOS picks the link whose media query matches the device;
// the splash bitmap itself is generated on demand by /api/splash.
const IOS_SPLASH_SIZES: Array<{
  w: number;
  h: number;
  pt: { w: number; h: number };
  ratio: 2 | 3;
}> = [
  { w: 1290, h: 2796, pt: { w: 430, h: 932 }, ratio: 3 }, // 15 Pro Max / 14 Pro Max
  { w: 1284, h: 2778, pt: { w: 428, h: 926 }, ratio: 3 }, // 14 Plus / 13 Pro Max / 12 Pro Max
  { w: 1179, h: 2556, pt: { w: 393, h: 852 }, ratio: 3 }, // 15 Pro / 14 Pro
  { w: 1170, h: 2532, pt: { w: 390, h: 844 }, ratio: 3 }, // 14 / 13 / 12
  { w: 1125, h: 2436, pt: { w: 375, h: 812 }, ratio: 3 }, // XS / X / 11 Pro
  { w: 1242, h: 2688, pt: { w: 414, h: 896 }, ratio: 3 }, // XS Max / 11 Pro Max
  { w: 828, h: 1792, pt: { w: 414, h: 896 }, ratio: 2 }, // XR / 11
  { w: 750, h: 1334, pt: { w: 375, h: 667 }, ratio: 2 }, // 8 / SE 2 / SE 3
];

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
      className={`${dmSans.variable} ${dmSerifDisplay.variable}${isDark ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeSyncScript }} />
        {IOS_SPLASH_SIZES.flatMap((s) => {
          const base = `(device-width: ${s.pt.w}px) and (device-height: ${s.pt.h}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)`;
          return [
            <link
              key={`light-${s.w}x${s.h}`}
              rel="apple-touch-startup-image"
              href={`/api/splash?w=${s.w}&h=${s.h}`}
              media={`${base} and (prefers-color-scheme: light)`}
            />,
            <link
              key={`dark-${s.w}x${s.h}`}
              rel="apple-touch-startup-image"
              href={`/api/splash?w=${s.w}&h=${s.h}&dark=1`}
              media={`${base} and (prefers-color-scheme: dark)`}
            />,
          ];
        })}
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
