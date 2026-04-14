import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { api } from "~/trpc/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/app/_components/sidebar";
import { Separator } from "~/app/_components/separator";
import { AppSidebar } from "~/app/_components/app-sidebar";

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
