"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { Bell, ClipboardPen, Gauge, Plus } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { MeterCard } from "./meter-card";
import { MeterFormDialog } from "./meter-form-dialog";
import { ReadMetersDialog } from "./read-meters-dialog";
import { ReminderSettingsDialog } from "./reminder-settings-dialog";

type MeterListItem = RouterOutputs["consumption"]["listMeters"][number];

export function ConsumptionClient() {
  const t = useTranslations("consumption");
  const utils = api.useUtils();

  const { data: meters, isLoading } = api.consumption.listMeters.useQuery({
    includeArchived: true,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MeterListItem | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const invalidate = () => {
    void utils.consumption.listMeters.invalidate();
    void utils.consumption.summary.invalidate();
  };

  const setArchived = api.consumption.setMeterArchived.useMutation({
    onSuccess: (_, vars) => {
      posthog.capture("consumption_meter_archived", {
        archived: vars.archived,
      });
      invalidate();
    },
  });
  const deleteMeter = api.consumption.deleteMeter.useMutation({
    onSuccess: () => {
      posthog.capture("consumption_meter_deleted");
      invalidate();
    },
  });

  if (isLoading) return null;

  const active = (meters ?? []).filter((m) => !m.archived);
  const archived = (meters ?? []).filter((m) => m.archived);
  const hasMeters = (meters?.length ?? 0) > 0;

  const handleDelete = (m: MeterListItem) => {
    if (confirm(t("deleteMeterConfirm", { name: m.name }))) {
      deleteMeter.mutate({ id: m.id });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button
              onClick={() => setReadOpen(true)}
              disabled={active.length === 0}
            >
              <ClipboardPen />
              {t("readMeters")}
            </Button>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("newMeter")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("reminders.title")}
              onClick={() => setRemindersOpen(true)}
            >
              <Bell />
            </Button>
          </>
        }
      />

      {!hasMeters ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState icon={Gauge} message={t("emptyState")} />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("createFirstMeter")}
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((m) => (
                <MeterCard
                  key={m.id}
                  item={m}
                  onEdit={() => setEditing(m)}
                  onArchiveToggle={() =>
                    setArchived.mutate({ id: m.id, archived: true })
                  }
                  onDelete={() => handleDelete(m)}
                />
              ))}
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">
                {t("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((m) => (
                  <MeterCard
                    key={m.id}
                    item={m}
                    onEdit={() => setEditing(m)}
                    onArchiveToggle={() =>
                      setArchived.mutate({ id: m.id, archived: false })
                    }
                    onDelete={() => handleDelete(m)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <MeterFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MeterFormDialog
        key={editing?.id ?? "edit"}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        meter={editing ?? undefined}
      />
      <ReadMetersDialog
        open={readOpen}
        onOpenChange={setReadOpen}
        onCreateMeter={() => {
          setReadOpen(false);
          setCreateOpen(true);
        }}
      />
      <ReminderSettingsDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
      />
    </div>
  );
}
