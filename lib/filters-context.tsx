"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  cloneRecords,
  defaultFilters,
  filterRecords,
  formatDateRange,
  uniqueDepartments,
  uniqueMonths,
} from "./data";
import { computeKpis } from "./kpis";
import type { DepartmentFilter, FilterState, HrRecord, RagStatus } from "./types";
import type { RawCsvRow } from "./csv";
import type { ClaimCheck, DatasetClaim } from "./claims";
import {
  DEFAULT_HR_PROFILE,
  filterGenericRows,
  uniqueGenericCategories,
  uniqueGenericMonths,
  type StoredDataset,
} from "./dataset";
import { registerFlusher } from "./persist-queue";

const LEGACY_DATASET_KEY = "northstar-active-dataset";

function datasetKey(userId: string) {
  return `cairn-dataset:${userId}`;
}

export type KpiStatusChange = {
  label: string;
  status: RagStatus | "neutral";
};

export type ClaimAlert = {
  stillTrue: boolean;
  message: string;
};

type FiltersContextValue = {
  filters: FilterState;
  setFilters: (next: FilterState) => void;
  setDepartment: (department: DepartmentFilter) => void;
  sourceRecords: HrRecord[];
  departments: string[];
  loading: boolean;
  dataError: string | null;
  clearDataError: () => void;
  persistRecord: (record: HrRecord) => Promise<boolean>;
  resetSourceRecords: () => Promise<boolean>;
  replaceSourceRecords: (next: HrRecord[]) => Promise<boolean>;
  replaceDataset: (next: StoredDataset) => Promise<boolean>;
  deleteSavedData: () => Promise<boolean>;
  dataset: StoredDataset | null;
  isHrDashboard: boolean;
  categoryFieldLabel: string;
  genericRows: RawCsvRow[];
  kpiStatusChanges: KpiStatusChange[];
  clearKpiStatusChanges: () => void;
  claimAlerts: ClaimAlert[];
  clearClaimAlerts: () => void;
  saveClaim: (claim: DatasetClaim) => Promise<boolean>;
  records: HrRecord[];
  dateRangeLabel: string;
  departmentLabel: string;
};

function readLocalDataset(userId: string): StoredDataset | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(datasetKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredDataset;
  } catch {
    return null;
  }
}

function writeLocalDataset(userId: string, dataset: StoredDataset | null) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(LEGACY_DATASET_KEY);
  if (!dataset) {
    window.localStorage.removeItem(datasetKey(userId));
    return;
  }
  window.localStorage.setItem(datasetKey(userId), JSON.stringify(dataset));
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

function asClaimChecks(value: unknown): ClaimCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ClaimCheck =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ClaimCheck).message === "string",
  );
}

function checksToAlerts(checks: ClaimCheck[]): ClaimAlert[] {
  const broken = checks.filter((item) => !item.stillTrue);
  return (broken.length > 0 ? broken : checks.slice(0, 1)).map((item) => ({
    stillTrue: item.stillTrue,
    message: item.message,
  }));
}

async function readJson(response: Response): Promise<{
  records?: HrRecord[];
  record?: HrRecord;
  error?: string;
  claimChecks?: ClaimCheck[];
}> {
  try {
    const payload = (await response.json()) as {
      records?: HrRecord[];
      record?: HrRecord;
      error?: string;
      claimChecks?: unknown;
    };
    return { ...payload, claimChecks: asClaimChecks(payload.claimChecks) };
  } catch {
    return { error: "The database request did not return JSON." };
  }
}

export function FiltersProvider({
  children,
  userId,
  initialRecords,
  initialError = null,
  initialDataset = null,
}: {
  children: ReactNode;
  userId: string;
  initialRecords: HrRecord[];
  initialError?: string | null;
  initialDataset?: StoredDataset | null;
}) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sourceRecords, setSourceRecords] = useState<HrRecord[]>(() =>
    cloneRecords(initialRecords),
  );
  const [dataset, setDataset] = useState<StoredDataset | null>(initialDataset);
  const [loading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(initialError);
  const [kpiStatusChanges, setKpiStatusChanges] = useState<KpiStatusChange[]>(
    [],
  );
  const [claimAlerts, setClaimAlerts] = useState<ClaimAlert[]>([]);
  const datasetRef = useRef<StoredDataset | null>(initialDataset);
  datasetRef.current = dataset;

  useEffect(() => {
    writeLocalDataset(userId, initialDataset);
    if (!initialDataset) {
      const local = readLocalDataset(userId);
      if (local) setDataset(local);
    }
    void fetch("/api/dataset")
      .then((response) => response.json())
      .then((payload: { dataset?: StoredDataset | null }) => {
        if (payload.dataset) {
          setDataset(payload.dataset);
          writeLocalDataset(userId, payload.dataset);
          return;
        }
        if ((payload as { error?: string }).error) return;
        setDataset(null);
        writeLocalDataset(userId, null);
      })
      .catch(() => undefined);
  }, [initialDataset, userId]);

  useEffect(() => {
    const isHr = !dataset || dataset.kind === "hr";
    if (!isHr && dataset) {
      const months = uniqueGenericMonths(dataset.rows, dataset.timeField);
      const categories = uniqueGenericCategories(dataset.rows, dataset.categoryField);
      if (months.length === 0 && categories.length === 0) return;
      setFilters((current) => {
        const startMonth = months.includes(current.startMonth)
          ? current.startMonth
          : months[0] ?? current.startMonth;
        const endMonth = months.includes(current.endMonth)
          ? current.endMonth
          : months[months.length - 1] ?? current.endMonth;
        const department =
          current.department === "All" || categories.includes(current.department)
            ? current.department
            : "All";
        if (
          startMonth === current.startMonth &&
          endMonth === current.endMonth &&
          department === current.department
        ) {
          return current;
        }
        return { startMonth, endMonth, department };
      });
      return;
    }
    const months = uniqueMonths(sourceRecords);
    if (months.length === 0) return;
    const departments = uniqueDepartments(sourceRecords);
    setFilters((current) => {
      const startMonth = months.includes(current.startMonth)
        ? current.startMonth
        : months[0];
      const endMonth = months.includes(current.endMonth)
        ? current.endMonth
        : months[months.length - 1];
      const department =
        current.department === "All" || departments.includes(current.department)
          ? current.department
          : "All";
      if (
        startMonth === current.startMonth &&
        endMonth === current.endMonth &&
        department === current.department
      ) {
        return current;
      }
      return { startMonth, endMonth, department };
    });
  }, [sourceRecords, dataset]);

  const noteStatusShifts = useCallback(
    (previous: HrRecord[], next: HrRecord[]) => {
      const before = computeKpis(filterRecords(previous, filters)).tiles;
      const after = computeKpis(filterRecords(next, filters)).tiles;
      const changes = after.flatMap((tile) => {
        const prior = before.find((item) => item.id === tile.id);
        if (!prior || prior.status === tile.status) return [];
        return [{ label: tile.label, status: tile.status }];
      });
      if (changes.length > 0) setKpiStatusChanges(changes);
    },
    [filters],
  );

  const persistRecord = useCallback(async (record: HrRecord) => {
      if (!record.id) {
        setDataError("That row is missing a database id.");
        return false;
      }

      let previous: HrRecord[] = [];
      let optimistic: HrRecord[] = [];
      setSourceRecords((current) => {
        previous = current;
        optimistic = current.map((item) =>
          item.id === record.id ? record : item,
        );
        return cloneRecords(optimistic);
      });
      noteStatusShifts(previous, optimistic);

      const response = await fetch("/api/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, record }),
      });
      const payload = await readJson(response);
      const saved = payload.record;
      if (!response.ok || !saved) {
        setSourceRecords(previous);
        setDataError(payload.error ?? "Could not save that change.");
        return false;
      }
      setSourceRecords((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      return true;
    }, [noteStatusShifts]);

  const resetSourceRecords = useCallback(async () => {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.records) {
      setDataError(payload.error ?? "Could not reset HR records.");
      return false;
    }
    noteStatusShifts(sourceRecords, payload.records);
    setSourceRecords(cloneRecords(payload.records));
    if (payload.claimChecks && payload.claimChecks.length > 0) {
      setClaimAlerts(checksToAlerts(payload.claimChecks));
    }
    return true;
  }, [noteStatusShifts, sourceRecords]);

  const replaceSourceRecords = useCallback(
    async (next: HrRecord[]) => {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace", records: next }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.records) {
        setDataError(payload.error ?? "Could not replace HR records.");
        return false;
      }
      noteStatusShifts(sourceRecords, payload.records);
      setSourceRecords(cloneRecords(payload.records));
      const hrDataset: StoredDataset = {
        ...DEFAULT_HR_PROFILE,
        filename: "Uploaded workforce file",
        rows: [],
      };
      setDataset(hrDataset);
      writeLocalDataset(userId, hrDataset);
      await fetch("/api/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: hrDataset }),
        keepalive: true,
      }).catch(() => undefined);
      if (payload.claimChecks && payload.claimChecks.length > 0) {
        setClaimAlerts(checksToAlerts(payload.claimChecks));
      }
      return true;
    },
    [noteStatusShifts, sourceRecords, userId],
  );

  const replaceDataset = useCallback(async (next: StoredDataset) => {
    writeLocalDataset(userId, next);
    setDataset(next);
    const response = await fetch("/api/dataset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset: next }),
      keepalive: true,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      claimChecks?: unknown;
    };
    if (!response.ok) {
      setDataError(payload.error ?? "Could not save dataset.");
      return false;
    }
    const checks = asClaimChecks(payload.claimChecks);
    if (checks.length > 0) setClaimAlerts(checksToAlerts(checks));
    return true;
  }, [userId]);

  const deleteSavedData = useCallback(async () => {
    const response = await fetch("/api/dataset", { method: "DELETE" });
    const payload = await readJson(response);
    if (!response.ok) {
      setDataError(payload.error ?? "Could not delete saved data.");
      return false;
    }
    writeLocalDataset(userId, null);
    setDataset(null);
    if (payload.records) {
      setSourceRecords(cloneRecords(payload.records));
    }
    setClaimAlerts([]);
    return true;
  }, [userId]);

  useEffect(() => {
    return registerFlusher(async () => {
      const current = datasetRef.current;
      if (!current) return;
      await fetch("/api/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: current }),
        keepalive: true,
      });
    });
  }, []);

  const saveClaim = useCallback(async (claim: DatasetClaim) => {
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (payload.error) setDataError(payload.error);
      return false;
    }
    return true;
  }, []);

  const clearKpiStatusChanges = useCallback(() => {
    setKpiStatusChanges([]);
  }, []);

  const clearClaimAlerts = useCallback(() => {
    setClaimAlerts([]);
  }, []);

  const clearDataError = useCallback(() => {
    setDataError(null);
  }, []);

  const setDepartment = useCallback((department: DepartmentFilter) => {
    setFilters((current) => ({ ...current, department }));
  }, []);

  const value = useMemo(() => {
    const isHrDashboard = !dataset || dataset.kind === "hr";
    const genericRows =
      !isHrDashboard && dataset
        ? filterGenericRows(
            dataset.rows,
            dataset,
            filters.startMonth,
            filters.endMonth,
            filters.department,
          )
        : [];
    const records = isHrDashboard
      ? filterRecords(sourceRecords, filters)
      : [];
    const departments = isHrDashboard
      ? uniqueDepartments(sourceRecords)
      : uniqueGenericCategories(dataset?.rows ?? [], dataset?.categoryField ?? null);
    return {
      filters,
      setFilters,
      setDepartment,
      sourceRecords,
      departments,
      loading,
      dataError,
      clearDataError,
      persistRecord,
      resetSourceRecords,
      replaceSourceRecords,
      replaceDataset,
      deleteSavedData,
      dataset,
      isHrDashboard,
      categoryFieldLabel: dataset?.categoryField || "Department",
      kpiStatusChanges,
      clearKpiStatusChanges,
      claimAlerts,
      clearClaimAlerts,
      saveClaim,
      records,
      dateRangeLabel: formatDateRange(filters.startMonth, filters.endMonth),
      departmentLabel: filters.department,
      genericRows,
    };
  }, [
    claimAlerts,
    clearClaimAlerts,
    clearDataError,
    clearKpiStatusChanges,
    dataError,
    saveClaim,
    dataset,
    filters,
    kpiStatusChanges,
    loading,
    persistRecord,
    replaceDataset,
    deleteSavedData,
    replaceSourceRecords,
    resetSourceRecords,
    setDepartment,
    sourceRecords,
  ]);

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error("useFilters must be used within FiltersProvider");
  }
  return context;
}
