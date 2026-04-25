"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  CreditCard,
  Calculator,
  ChevronRight,
  Landmark,
  FolderHeart,
} from "lucide-react";

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
import { FamilySwitcher } from "~/app/_components/family-switcher";
import { FavoritesNavGroup } from "~/app/_components/favorites-nav-group";
import { UserMenu } from "~/app/_components/user-menu";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" data-tour-id="navigation" {...props}>
      <SidebarHeader>
        <FamilySwitcher />
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

        <FavoritesNavGroup />

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

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/projects")}
                >
                  <Link href="/projects">
                    <FolderHeart />
                    <span>{t("projects")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Budgets with sub-items */}
              <Collapsible
                asChild
                defaultOpen={pathname.startsWith("/budgets")}
              >
                <SidebarMenuItem data-tour-id="budgets">
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
                          isActive={pathname.startsWith("/budgets/annual")}
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

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
