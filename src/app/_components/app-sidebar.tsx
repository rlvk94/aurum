"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  CreditCard,
  Calculator,
  Settings,
  ChevronsUpDown,
  LogOut,
  ChevronUp,
  ChevronRight,
  Users,
  Plus,
  Home,
  Landmark,
} from "lucide-react";
import { authClient } from "~/app/_lib/auth-client";
import { api } from "~/trpc/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "~/app/_components/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/app/_components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("nav");
  const tFamily = useTranslations("family");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: families } = api.family.list.useQuery();
  const { data: activeFamilyId } = api.user.getActiveFamily.useQuery();
  const utils = api.useUtils();

  const setActiveFamily = api.user.setActiveFamily.useMutation({
    onSuccess: () => {
      void utils.user.getActiveFamily.invalidate();
    },
  });

  const activeFamily =
    families?.find((f) => f.familyId === activeFamilyId) ?? families?.[0];

  // Auto-set active family if none is set
  React.useEffect(() => {
    if (activeFamily && !activeFamilyId) {
      setActiveFamily.mutate({ familyId: activeFamily.familyId });
    }
  }, [activeFamily, activeFamilyId, setActiveFamily]);

  const switchFamily = (familyId: string) => {
    setActiveFamily.mutate({ familyId });
  };

  return (
    <Sidebar variant="inset" {...props}>
      {/* Family switcher */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Home className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {activeFamily?.familyName}
                    </span>
                    <span className="truncate text-xs">
                      {activeFamily?.role === "owner"
                        ? tFamily("owner")
                        : tFamily("member")}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-popper-anchor-width)"
                align="start"
              >
                {families?.map((f) => (
                  <DropdownMenuItem
                    key={f.familyId}
                    onClick={() => switchFamily(f.familyId)}
                  >
                    <Home className="mr-2 size-4" />
                    <span className="flex-1 truncate">{f.familyName}</span>
                    {f.familyId === activeFamily?.familyId && (
                      <span className="ml-2 h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Plus className="mr-2 size-4" />
                  {tFamily("createFamily")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard — top level, no label */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                >
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>{t("dashboard")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Finance */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("finance")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/transactions"}
                >
                  <Link href="/transactions">
                    <ArrowLeftRight />
                    <span>{t("transactions")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/accounts"}
                >
                  <Link href="/accounts">
                    <Wallet />
                    <span>{t("accounts")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Budgets with sub-items */}
              <Collapsible
                asChild
                defaultOpen={pathname.startsWith("/budgets")}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={pathname.startsWith("/budgets")}>
                      <PieChart />
                      <span>{t("budgets")}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === "/budgets/annual"}
                        >
                          <Link href="/budgets/annual">
                            {t("annualBudget")}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === "/budgets/challenges"}
                        >
                          <Link href="/budgets/challenges">
                            {t("challenges")}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Net Worth */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("netWorthSection")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/assets"}
                >
                  <Link href="/assets">
                    <Landmark />
                    <span>{t("assets")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/debts"}
                >
                  <Link href="/debts">
                    <CreditCard />
                    <span>{t("debts")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("tools")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/income-planner"}
                >
                  <Link href="/income-planner">
                    <Calculator />
                    <span>{t("incomePlanner")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User menu */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                    <Users className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {session?.user.name}
                    </span>
                    <span className="truncate text-xs">
                      {session?.user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-popper-anchor-width)"
                side="top"
                align="start"
              >
                <DropdownMenuItem>
                  <Settings className="mr-2 size-4" />
                  {tCommon("settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    router.push("/login");
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  {tCommon("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
