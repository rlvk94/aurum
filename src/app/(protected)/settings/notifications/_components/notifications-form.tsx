"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bell, Trash2 } from "lucide-react";

import { api } from "~/trpc/react";
import { usePushSubscription as usePush } from "~/app/_hooks/use-push-subscription";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import { Switch } from "~/app/_components/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

type ChannelId = "email" | "push";

export function NotificationsForm() {
  const t = useTranslations("settings.notifications");
  const locale = useLocale();
  const utils = api.useUtils();

  const { data: prefs } = api.notification.getPreferences.useQuery();
  const { data: devices } = api.notification.listDevices.useQuery();

  const setPreference = api.notification.setPreference.useMutation({
    onMutate: async (vars) => {
      await utils.notification.getPreferences.cancel();
      const prev = utils.notification.getPreferences.getData();
      utils.notification.getPreferences.setData(undefined, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((it) =>
                it.type === vars.type
                  ? {
                      ...it,
                      channels: {
                        ...it.channels,
                        [vars.channel]: vars.enabled,
                      },
                    }
                  : it,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.notification.getPreferences.setData(undefined, ctx.prev);
      }
    },
    onSettled: () => void utils.notification.getPreferences.invalidate(),
  });

  const channels = (prefs?.channels ?? ["email", "push"]) as ChannelId[];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("preferencesTitle")}</CardTitle>
          <CardDescription>{t("preferencesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-sm">
                <th className="pb-2 font-medium">{t("typeColumn")}</th>
                {channels.map((channel) => (
                  <th
                    key={channel}
                    className="w-20 pb-2 text-center font-medium"
                  >
                    {t(`${channel}Column`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prefs?.items.map((item) => (
                <tr key={item.type} className="border-border/50 border-b">
                  <td className="py-4 pr-4">
                    <div className="text-foreground text-sm font-medium">
                      {t(`types.${item.type}.label`)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t(`types.${item.type}.description`)}
                    </div>
                  </td>
                  {channels.map((channel) => {
                    const available = item.availableChannels.includes(channel);
                    return (
                      <td key={channel} className="py-4 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={Boolean(item.channels[channel])}
                            disabled={!available || setPreference.isPending}
                            aria-label={`${t(`types.${item.type}.label`)} — ${t(`${channel}Column`)}`}
                            onCheckedChange={(enabled) =>
                              setPreference.mutate({
                                type: item.type,
                                channel,
                                enabled,
                              })
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PushDeviceCard
        devices={devices ?? []}
        locale={locale}
        onRemoved={() => void utils.notification.listDevices.invalidate()}
      />
    </div>
  );
}

type Device = {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function PushDeviceCard({
  devices,
  locale,
  onRemoved,
}: {
  devices: Device[];
  locale: string;
  onRemoved: () => void;
}) {
  const t = useTranslations("settings.notifications");
  const push = usePush();

  const unsubscribe = api.notification.unsubscribeDevice.useMutation({
    onSuccess: onRemoved,
  });

  const blockedNote =
    push.permission === "denied" ? (
      <p className="text-warning text-xs">{t("permissionDenied")}</p>
    ) : null;

  const installNote =
    push.isIos && !push.isStandalone ? (
      <p className="text-muted-foreground text-xs">{t("iosInstallHint")}</p>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("deviceTitle")}</CardTitle>
        <CardDescription>{t("deviceDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!push.supported || !push.configured ? (
          <p className="text-muted-foreground text-sm">{t("unsupported")}</p>
        ) : (
          <div className="space-y-2">
            <Button
              variant={push.isSubscribed ? "outline" : "default"}
              disabled={
                push.isBusy ||
                push.permission === "denied" ||
                (push.isIos && !push.isStandalone)
              }
              onClick={() =>
                push.isSubscribed
                  ? void push.unsubscribe()
                  : void push.subscribe()
              }
            >
              <Bell />
              {push.isBusy
                ? t("enabling")
                : push.isSubscribed
                  ? t("disableOnDevice")
                  : t("enableOnDevice")}
            </Button>
            {blockedNote}
            {installNote}
          </div>
        )}

        <div>
          <h3 className="text-foreground mb-2 text-sm font-medium">
            {t("devicesHeading")}
          </h3>
          {devices.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noDevices")}</p>
          ) : (
            <ul className="divide-border/50 divide-y">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="min-w-0">
                    <div className="text-foreground truncate text-sm">
                      {deviceLabel(device.userAgent) ?? t("unknownDevice")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t("addedOn", {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(device.createdAt)),
                      })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove")}
                    disabled={unsubscribe.isPending}
                    onClick={() =>
                      unsubscribe.mutate({ endpoint: device.endpoint })
                    }
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Best-effort human label from a user-agent string. */
function deviceLabel(ua: string | null): string | null {
  if (!ua) return null;
  const isIos = ua.includes("iPhone") || ua.includes("iPad");
  const os = isIos
    ? "iOS"
    : ua.includes("Android")
      ? "Android"
      : ua.includes("Mac OS X")
        ? "macOS"
        : ua.includes("Windows")
          ? "Windows"
          : ua.includes("Linux")
            ? "Linux"
            : null;
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/")
          ? "Safari"
          : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
