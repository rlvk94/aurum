"use client";

import { useCallback, useEffect, useState } from "react";

import { env } from "~/env";
import { api } from "~/trpc/react";

const SW_URL = "/sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag for home-screen apps.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export type PushSubscriptionState = {
  /** Browser supports service workers + push. */
  supported: boolean;
  /** VAPID public key is configured (push can work at all). */
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isBusy: boolean;
  isIos: boolean;
  isStandalone: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePushSubscription(): PushSubscriptionState {
  const [supported, setSupported] = useState(false);
  const [configured] = useState(Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY));
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const utils = api.useUtils();
  const subscribeDevice = api.notification.subscribeDevice.useMutation();
  const unsubscribeDevice = api.notification.unsubscribeDevice.useMutation();

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    setIsIos(detectIos());
    setIsStandalone(detectStandalone());
    if (!ok) return;

    setPermission(Notification.permission);
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(Boolean(sub)))
      .catch(() => setIsSubscribed(false));
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !configured || isBusy) return;
    setIsBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ) as BufferSource,
        }));

      const json = sub.toJSON();
      await subscribeDevice.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 512),
      });
      setIsSubscribed(true);
      await utils.notification.listDevices.invalidate();
    } finally {
      setIsBusy(false);
    }
  }, [supported, configured, isBusy, subscribeDevice, utils]);

  const unsubscribe = useCallback(async () => {
    if (!supported || isBusy) return;
    setIsBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeDevice
          .mutateAsync({ endpoint: sub.endpoint })
          .catch(() => undefined);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      await utils.notification.listDevices.invalidate();
    } finally {
      setIsBusy(false);
    }
  }, [supported, isBusy, unsubscribeDevice, utils]);

  return {
    supported,
    configured,
    permission,
    isSubscribed,
    isBusy,
    isIos,
    isStandalone,
    subscribe,
    unsubscribe,
  };
}
