import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/app/_components/sidebar";
import { Separator } from "~/app/_components/separator";
import {
  GraceBanner,
  PendingBillingBanner,
} from "~/app/_components/billing/grace-banner";
import { UpgradeModalProvider } from "~/app/_components/billing/upgrade-modal";
import { CommandPaletteProvider } from "~/app/_components/command-palette";
import { KeyboardShortcutsProvider } from "~/app/_components/keyboard-shortcuts-provider";
import { PageMetadataProvider } from "~/app/_components/page-metadata";
import { ProtectedSidebar } from "~/app/_components/protected-sidebar";
import { TopNav } from "~/app/_components/top-nav";
import { TutorialProvider } from "~/app/_components/tutorial";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const onboarding = await api.user.getOnboardingState();

  if (!onboarding.onboardedAt) {
    redirect("/welcome");
  }

  // Prefetch sidebar data so client components hydrate instantly
  await Promise.all([
    api.family.list.prefetch(),
    api.user.getActiveFamily.prefetch(),
    api.user.me.prefetch(),
    api.favorite.list.prefetch(),
    api.announcement.list.prefetch(),
    api.billing.current.prefetch(),
  ]);

  return (
    <HydrateClient>
      <UpgradeModalProvider>
       <SidebarProvider>
        <CommandPaletteProvider>
          <KeyboardShortcutsProvider>
            <PageMetadataProvider>
              <TutorialProvider>
                <ProtectedSidebar />
                <SidebarInset className="min-w-0">
                  <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/95 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:min-h-16 sm:px-6">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                      orientation="vertical"
                      className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <TopNav />
                  </header>
                  <GraceBanner />
                  <PendingBillingBanner />
                  <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:gap-6 sm:p-6">
                    {children}
                  </div>
                </SidebarInset>
              </TutorialProvider>
            </PageMetadataProvider>
          </KeyboardShortcutsProvider>
        </CommandPaletteProvider>
       </SidebarProvider>
      </UpgradeModalProvider>
    </HydrateClient>
  );
}
