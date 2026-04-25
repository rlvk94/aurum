"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { cn } from "~/app/_lib/utils";
import { SectionMarker } from "./section-marker";

export function LandingContact() {
  const t = useTranslations("landing.contact");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const send = api.contact.send.useMutation({
    onSuccess: () => {
      setName("");
      setEmail("");
      setMessage("");
      setErrorKey(null);
    },
    onError: () => {
      setErrorKey("error");
    },
  });

  const isSubmitted = send.isSuccess;
  const isSubmitting = send.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorKey(null);
    send.mutate({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
  };

  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <header className="max-w-2xl">
          <SectionMarker>{t("marker")}</SectionMarker>
          <h2 className="mt-4 font-display text-4xl leading-tight text-foreground sm:text-5xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("lead")}
          </p>
        </header>

        <div className="almanac-rule mt-10" />

        {isSubmitted ? (
          <div className="mt-10 rounded-lg border border-primary/30 bg-(--accent) p-8 text-center">
            <div className="font-display text-2xl text-foreground">
              {t("success")}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label={t("fields.name")}
                htmlFor="contact-name"
                required
              >
                <Input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("fields.namePlaceholder")}
                  required
                  minLength={1}
                  maxLength={120}
                  disabled={isSubmitting}
                />
              </Field>
              <Field
                label={t("fields.email")}
                htmlFor="contact-email"
                required
              >
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("fields.emailPlaceholder")}
                  required
                  maxLength={320}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <Field
              label={t("fields.message")}
              htmlFor="contact-message"
              required
            >
              <textarea
                id="contact-message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("fields.messagePlaceholder")}
                required
                minLength={5}
                maxLength={4000}
                rows={6}
                disabled={isSubmitting}
                className={cn(
                  "flex w-full rounded-md border border-input bg-card px-3 py-2 text-base ring-offset-background",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                  "resize-y leading-relaxed",
                )}
              />
            </Field>

            {errorKey && (
              <p className="text-sm text-destructive" role="alert">
                {t(errorKey)}
              </p>
            )}

            <div className="flex items-center justify-end">
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="almanac-smallcaps mb-2 block text-[10px] tracking-[0.22em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-primary">·</span>}
      </span>
      {children}
    </label>
  );
}
