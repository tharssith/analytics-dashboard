"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export type KpiStatusChange = {
  label: string;
  status: RagStatus | "neutral";
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
  kpiStatusChanges: KpiStatusChange[];
  clearKpiStatusChanges: () => void;
  records: HrRecord[];
  dateRangeLabel: string;
  departmentLabel: string;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

async function readJson(response: Response): Promise<{
  records?: HrRecord[];
  record?: HrRecord;
  error?: string;
}> {
  try {
    return (await response.json()) as {
      records?: HrRecord[];
      record?: HrRecord;
      error?: string;
    };
  } catch {
    return { error: "The database request did not return JSON." };
  }
}

export function FiltersProvider({
  children,
  initialRecords,
  initialError = null,
}: {
  children: ReactNode;
  initialRecords: HrRecord[];
  initialError?: string | null;
}) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sourceRecords, setSourceRecords] = useState<HrRecord[]>(() =>
    cloneRecords(initialRecords),
  );
  const [loading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(initialError);
  const [kpiStatusChanges, setKpiStatusChanges] = useState<KpiStatusChange[]>(
    [],
  );

  useEffect(() => {
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
  }, [sourceRecords]);

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
      return true;
    },
    [noteStatusShifts, sourceRecords],
  );

  const clearKpiStatusChanges = useCallback(() => {
    setKpiStatusChanges([]);
  }, []);

  const clearDataError = useCallback(() => {
    setDataError(null);
  }, []);

  const setDepartment = useCallback((department: DepartmentFilter) => {
    setFilters((current) => ({ ...current, department }));
  }, []);

  const value = useMemo(() => {
    const records = filterRecords(sourceRecords, filters);
    return {
      filters,
      setFilters,
      setDepartment,
      sourceRecords,
      departments: uniqueDepartments(sourceRecords),
      loading,
      dataError,
      clearDataError,
      persistRecord,
      resetSourceRecords,
      replaceSourceRecords,
      kpiStatusChanges,
      clearKpiStatusChanges,
      records,
      dateRangeLabel: formatDateRange(filters.startMonth, filters.endMonth),
      departmentLabel: filters.department,
    };
  }, [
    clearDataError,
    clearKpiStatusChanges,
    dataError,
    filters,
    kpiStatusChanges,
    loading,
    persistRecord,
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
