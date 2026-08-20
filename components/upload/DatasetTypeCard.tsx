"use client";

import { DATASET_KINDS, KIND_LABELS, type DatasetKind, type DatasetProfile } from "@/lib/dataset";
import { Card } from "@/components/ui/Card";
import { selectClass } from "@/components/upload/upload-ui";

export function DatasetTypeCard({
  profile,
  loading,
  onKindChange,
  onTimeChange,
  onCategoryChange,
}: {
  profile: DatasetProfile;
  loading?: boolean;
  onKindChange: (kind: DatasetKind) => void;
  onTimeChange: (field: string) => void;
  onCategoryChange: (field: string) => void;
}) {
  return (
    <Card className="mb-5 max-w-xl p-5">
      <h2 className="text-base font-semibold text-foreground">File type</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        AI compares the file name with the column headers, then the dashboard
        and analysis follow this type.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-muted">Checking file name against columns…</p>
      ) : null}
      <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-muted">
        Dataset type
        <select
          value={profile.kind}
          onChange={(event) => onKindChange(event.target.value as DatasetKind)}
          className={selectClass}
        >
          {DATASET_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Time / date column
          <select
            value={profile.timeField ?? ""}
            onChange={(event) => onTimeChange(event.target.value)}
            className={selectClass}
          >
            <option value="">None</option>
            {profile.headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Category column
          <select
            value={profile.categoryField ?? ""}
            onChange={(event) => onCategoryChange(event.target.value)}
            className={selectClass}
          >
            <option value="">None</option>
            {profile.headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={`mt-3 text-sm ${profile.nameHeaderMatch ? "text-foreground" : "text-rag-amber"}`}>
        {profile.reason}
      </p>
      <p className="mt-1 text-xs text-muted">
        Name → {KIND_LABELS[profile.typeFromName]} · Columns → {KIND_LABELS[profile.typeFromHeaders]}
        {profile.metricFields.length > 0
          ? ` · Metrics: ${profile.metricFields.slice(0, 4).join(", ")}`
          : ""}
      </p>
    </Card>
  );
}
