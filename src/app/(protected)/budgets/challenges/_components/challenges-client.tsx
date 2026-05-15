"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Target } from "lucide-react";

import posthog from "posthog-js";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { FamilyFeatureTeaser } from "~/app/_components/billing/family-feature-teaser";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import { ChallengeCard } from "./challenge-card";
import { ChallengeFormDialog } from "./challenge-form-dialog";

type Challenge = RouterOutputs["challenge"]["list"][number];

export function ChallengesClient() {
  const t = useTranslations("budgets");
  const tTeaser = useTranslations("billing.featureCopy.challenges");
  const utils = api.useUtils();
  const { has } = useEntitlements();

  const { data: challenges, isLoading } = api.challenge.list.useQuery(
    { includeArchived: true },
    { enabled: has("challenges") },
  );

  if (!has("challenges")) {
    let bullets: string[] = [];
    try {
      bullets = (tTeaser.raw("bullets") as string[]) ?? [];
    } catch {
      bullets = [];
    }
    return <FamilyFeatureTeaser feature="challenges" bullets={bullets} />;
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);

  const invalidate = () => {
    void utils.challenge.list.invalidate();
  };

  const setArchived = api.challenge.setArchived.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("challenge_archived", { archived: variables.archived });
      invalidate();
    },
  });
  const deleteChallenge = api.challenge.delete.useMutation({
    onSuccess: invalidate,
  });

  if (isLoading) return null;

  const active = challenges?.filter((c) => !c.archivedAt) ?? [];
  const archived = challenges?.filter((c) => c.archivedAt) ?? [];

  const handleDelete = (c: Challenge) => {
    if (confirm(t("challengeDeleteConfirm", { name: c.name }))) {
      deleteChallenge.mutate({ id: c.id });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("challenges")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("createChallenge")}
          </Button>
        }
      />

      {!challenges || challenges.length === 0 ? (
        <EmptyState icon={Target} message={t("challengesEmptyState")} />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  onEdit={() => setEditing(c)}
                  onArchiveToggle={() =>
                    setArchived.mutate({ id: c.id, archived: true })
                  }
                  onDelete={() => handleDelete(c)}
                />
              ))}
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">
                {t("challengeStatuses.archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    onEdit={() => setEditing(c)}
                    onArchiveToggle={() =>
                      setArchived.mutate({ id: c.id, archived: false })
                    }
                    onDelete={() => handleDelete(c)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ChallengeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ChallengeFormDialog
        key={editing?.id}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        challenge={editing ?? undefined}
      />
    </div>
  );
}
