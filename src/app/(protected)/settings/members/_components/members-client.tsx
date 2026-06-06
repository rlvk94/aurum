"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MoreHorizontal, UserRound } from "lucide-react";

import posthog from "posthog-js";
import { api, type RouterOutputs } from "~/trpc/react";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Badge } from "~/app/_components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";

type Member = RouterOutputs["family"]["listMembers"][number];

function MemberAvatar({ image, name }: { image: string | null; name: string }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  if (image) {
    return (
      <div className="border-border bg-muted h-9 w-9 overflow-hidden rounded-full border">
        {/* eslint-disable-next-line @next/next/no-img-element -- external avatar URL (e.g. Google), tiny 36px image; next/image remotePatterns config not warranted */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  return (
    <div className="bg-accent text-accent-foreground flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium">
      {initials || <UserRound className="size-4" />}
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  isOwnerViewer,
  isLastOwner,
  onChangeRole,
  onRemove,
  onLeave,
}: {
  member: Member;
  isSelf: boolean;
  isOwnerViewer: boolean;
  isLastOwner: boolean;
  onChangeRole: (role: "owner" | "member") => void;
  onRemove: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("settings.members");

  const canShowActions = (isOwnerViewer && !isSelf) || (isSelf && !isLastOwner);

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-3">
      <MemberAvatar image={member.image} name={member.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name}</span>
          {isSelf && (
            <Badge variant="secondary" className="shrink-0">
              {t("you")}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-sm">{member.email}</p>
      </div>
      <Badge variant={member.role === "owner" ? "default" : "outline"}>
        {member.role === "owner" ? t("roleOwner") : t("roleMember")}
      </Badge>
      {canShowActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwnerViewer && !isSelf && (
              <>
                {member.role === "member" ? (
                  <DropdownMenuItem onClick={() => onChangeRole("owner")}>
                    {t("roleOwner")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onChangeRole("member")}>
                    {t("roleMember")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onRemove}
                  className="text-destructive focus:text-destructive"
                >
                  {t("remove")}
                </DropdownMenuItem>
              </>
            )}
            {isSelf && !isLastOwner && (
              <DropdownMenuItem
                onClick={onLeave}
                className="text-destructive focus:text-destructive"
              >
                {t("leave")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function InviteForm({
  familyName,
  atLimit,
}: {
  familyName: string | undefined;
  atLimit: boolean;
}) {
  const t = useTranslations("settings.members.invite");
  const tBilling = useTranslations("billing.errors");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createInvite = api.invitation.create.useMutation({
    onSuccess: () => {
      posthog.capture("member_invited");
      void utils.invitation.list.invalidate();
      setEmail("");
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>
          {familyName
            ? `${t("description")} · ${familyName}`
            : t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {atLimit && (
          <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            {tBilling("limitReached")}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createInvite.mutate({ email: email.trim() });
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={atLimit}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={createInvite.isPending || atLimit}>
            {createInvite.isPending ? tCommon("loading") : t("send")}
          </Button>
        </form>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}

function PendingInvitation({
  id,
  email,
  createdAt,
  canRevoke,
}: {
  id: string;
  email: string;
  createdAt: Date;
  canRevoke: boolean;
}) {
  const tPending = useTranslations("settings.members.pending");
  const format = useFormatter();
  const utils = api.useUtils();

  const revoke = api.invitation.revoke.useMutation({
    onSuccess: () => void utils.invitation.list.invalidate(),
  });

  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{email}</p>
        <p className="text-muted-foreground text-xs">
          {tPending("sentAt", {
            date: format.dateTime(createdAt, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      </div>
      {canRevoke && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => revoke.mutate({ id })}
          disabled={revoke.isPending}
          className="text-destructive hover:text-destructive"
        >
          {tPending("revoke")}
        </Button>
      )}
    </div>
  );
}

export function MembersClient() {
  const t = useTranslations("settings.members");
  const tPending = useTranslations("settings.members.pending");
  const utils = api.useUtils();

  const { data: current } = api.family.current.useQuery();
  const { data: members } = api.family.listMembers.useQuery();
  const { data: invitations } = api.invitation.list.useQuery();
  const { data: me } = api.user.me.useQuery();
  const { limit } = useEntitlements();

  const isOwner = current?.role === "owner";

  const ownerCount = members?.filter((m) => m.role === "owner").length ?? 0;
  const memberCount = members?.length ?? 0;
  const pendingCount = invitations?.length ?? 0;
  const atMemberLimit = memberCount + pendingCount >= limit("maxMembers");

  const changeRole = api.family.updateMemberRole.useMutation({
    onSuccess: () => void utils.family.listMembers.invalidate(),
  });
  const removeMember = api.family.removeMember.useMutation({
    onSuccess: () => void utils.family.listMembers.invalidate(),
  });
  const leaveFamily = api.family.leave.useMutation({
    onSuccess: () => {
      void utils.family.listMembers.invalidate();
      void utils.family.list.invalidate();
      void utils.user.getActiveFamily.invalidate();
      window.location.href = "/dashboard";
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {isOwner && (
        <InviteForm familyName={current?.name} atLimit={atMemberLimit} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(members ?? []).map((m) => {
            const isSelf = m.userId === me?.id;
            const isLastOwner = m.role === "owner" && ownerCount <= 1;
            return (
              <MemberRow
                key={m.userId}
                member={m}
                isSelf={isSelf}
                isOwnerViewer={Boolean(isOwner)}
                isLastOwner={isLastOwner}
                onChangeRole={(role) =>
                  changeRole.mutate({ userId: m.userId, role })
                }
                onRemove={() => {
                  if (window.confirm(t("confirmRemove", { name: m.name }))) {
                    removeMember.mutate({ userId: m.userId });
                  }
                }}
                onLeave={() => {
                  if (window.confirm(t("confirmLeave"))) {
                    leaveFamily.mutate();
                  }
                }}
              />
            );
          })}
          {members?.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("empty")}
            </p>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tPending("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(invitations ?? []).map((inv) => (
              <PendingInvitation
                key={inv.id}
                id={inv.id}
                email={inv.email}
                createdAt={inv.createdAt}
                canRevoke={isOwner}
              />
            ))}
            {invitations?.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {tPending("empty")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
