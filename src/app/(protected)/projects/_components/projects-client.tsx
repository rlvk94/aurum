"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, FolderHeart, Plus } from "lucide-react";
import posthog from "posthog-js";

import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import { FamilyFeatureTeaser } from "~/app/_components/billing/family-feature-teaser";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import { cn } from "~/app/_lib/utils";

import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { deriveProgress, type ProjectPalette } from "../_lib/format";

type Project = RouterOutputs["project"]["list"][number];

type Suggestion = {
  key: "vacation" | "renovation" | "wedding";
  emoji: string;
  palette: ProjectPalette;
};

const SUGGESTIONS: Suggestion[] = [
  { key: "vacation", emoji: "🏖️", palette: "ocean" },
  { key: "renovation", emoji: "🛠️", palette: "clay" },
  { key: "wedding", emoji: "💐", palette: "plum" },
];

type Filter = "all" | "active" | "ended";

export function ProjectsClient() {
  const t = useTranslations("projects");
  const tTeaser = useTranslations("billing.featureCopy.projects");
  const utils = api.useUtils();
  const { has } = useEntitlements();

  const { data: projects } = api.project.list.useQuery(
    { includeArchived: true },
    { enabled: has("projects") },
  );
  const { data: categories = [] } = api.category.list.useQuery(undefined, {
    enabled: has("projects"),
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    name?: string;
    emoji?: string;
    coverPalette?: ProjectPalette;
  }>({});
  const [editing, setEditing] = useState<Project | null>(null);

  const setArchived = api.project.setArchived.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("project_archived", { archived: variables.archived });
      void utils.project.list.invalidate();
    },
  });
  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => void utils.project.list.invalidate(),
  });

  const { active, archived } = useMemo(() => {
    const all = projects ?? [];
    const active = all
      .filter((p) => !p.archivedAt)
      .filter((p) => {
        if (filter === "all") return true;
        const status = deriveProgress({
          startDate: p.startDate,
          endDate: p.endDate,
          spendingLimit: p.spendingLimit,
          net: p.net,
        }).status;
        if (filter === "active")
          return (
            status === "active" ||
            status === "not_started" ||
            status === "no_dates"
          );
        if (filter === "ended")
          return status === "ended" || status === "met" || status === "over";
        return true;
      });
    const archived = all.filter((p) => p.archivedAt);
    return { active, archived };
  }, [projects, filter]);

  function handleSuggestion(s: Suggestion) {
    setCreateDefaults({
      name: t(`suggestions.${s.key}`),
      emoji: s.emoji,
      coverPalette: s.palette,
    });
    setCreateOpen(true);
  }

  function handleDelete(p: Project) {
    if (confirm(t("actions.deleteConfirm", { name: p.name }))) {
      deleteProject.mutate({ id: p.id });
    }
  }

  const isEmpty = (projects ?? []).length === 0;

  if (!has("projects")) {
    const bullets = (tTeaser.raw("bullets") as string[]) ?? [];
    return <FamilyFeatureTeaser feature="projects" bullets={bullets} />;
  }

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button
            onClick={() => {
              setCreateDefaults({});
              setCreateOpen(true);
            }}
          >
            <Plus />
            {t("createProject")}
          </Button>
        }
      />

      {isEmpty ? (
        <EmptyHero suggestions={SUGGESTIONS} onPick={handleSuggestion} />
      ) : (
        <>
          <div className="border-border bg-card shadow-card flex flex-wrap items-center gap-1 rounded-full border p-1 sm:w-fit">
            {(["all", "active", "ended"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  filter === f
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`filters.${f}`)}
              </button>
            ))}
          </div>

          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  categories={categories}
                  onEdit={() => setEditing(p)}
                  onArchiveToggle={() =>
                    setArchived.mutate({ id: p.id, archived: true })
                  }
                  onDelete={() => handleDelete(p)}
                />
              ))}
            </div>
          )}

          {active.length === 0 && (
            <p className="border-border bg-card/50 text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
              {t("emptyState")}
            </p>
          )}

          {archived.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-muted-foreground text-base">
                {t("archivedHeading")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    categories={categories}
                    onEdit={() => setEditing(p)}
                    onArchiveToggle={() =>
                      setArchived.mutate({ id: p.id, archived: false })
                    }
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateDefaults({});
        }}
        defaults={createDefaults}
      />
      <ProjectFormDialog
        key={editing?.id ?? "edit"}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        project={editing ?? undefined}
      />
    </div>
  );
}

function EmptyHero({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
}) {
  const t = useTranslations("projects");

  return (
    <div className="border-border bg-card shadow-card rounded-2xl border p-8 sm:p-12">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-8">
        <div
          data-project-palette="gold"
          className="project-cover-shimmer shadow-elevated flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
        >
          <FolderHeart className="h-10 w-10 text-[var(--cover-glyph)]" />
        </div>
        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-foreground text-3xl">
            {t("emptyStateTitle")}
          </h2>
          <p className="text-muted-foreground">{t("emptyStateBody")}</p>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        <p className="text-foreground text-sm font-medium">
          {t("suggestionsLabel")}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onPick(s)}
              className="group border-border bg-background hover:border-primary/40 hover:shadow-card flex items-center gap-4 rounded-xl border p-4 text-left transition hover:-translate-y-0.5"
            >
              <span
                data-project-palette={s.palette}
                className="project-cover-shimmer flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl"
              >
                <span className="project-cover-emoji">{s.emoji}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-foreground text-lg">
                  {t(`suggestions.${s.key}`)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("createProjectShort")}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
