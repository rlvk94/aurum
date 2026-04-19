"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Home, Plus } from "lucide-react";
import { api } from "~/trpc/react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/app/_components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";

export function FamilySwitcher() {
  const tFamily = useTranslations("family");
  const tCommon = useTranslations("common");
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

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newFamilyName, setNewFamilyName] = React.useState("");

  const createFamily = api.family.create.useMutation({
    onSuccess: (newFamily) => {
      setCreateDialogOpen(false);
      setNewFamilyName("");
      void utils.family.list.invalidate();
      if (newFamily) {
        setActiveFamily.mutate({ familyId: newFamily.id });
      }
    },
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem data-tour-id="family-switcher">
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
                onClick={() => setActiveFamily.mutate({ familyId: f.familyId })}
              >
                <Home  />
                <span className="flex-1 truncate">{f.familyName}</span>
                {f.familyId === activeFamily?.familyId && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
              <Plus  />
              {tFamily("createFamily")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tFamily("createFamily")}</DialogTitle>
              <DialogDescription>
                {tFamily("createFamilyDescription")}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newFamilyName.trim()) {
                  createFamily.mutate({ name: newFamilyName.trim() });
                }
              }}
            >
              <div className="space-y-2 py-4">
                <label
                  htmlFor="newFamilyName"
                  className="text-sm font-medium"
                >
                  {tFamily("familyName")}
                </label>
                <Input
                  id="newFamilyName"
                  placeholder={tFamily("familyNamePlaceholder")}
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={
                    !newFamilyName.trim() || createFamily.isPending
                  }
                >
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
