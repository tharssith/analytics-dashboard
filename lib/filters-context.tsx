"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cloneRecords,
  defaultFilters,
  filterRecords,
  formatDateRange,
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
  saveSourceRecords: (next: HrRecord[]) => void;
  resetSourceRecords: () => void;
  kpiStatusChanges: KpiStatusChange[];
  clearKpiStatusChanges: () => void;
  records: HrRecord[];
  dateRangeLabel: string;
  departmentLabel: string;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sourceRecords, setSourceRecords] = useState<HrRecord[]>(() =>
    cloneRecords(),
  );
  const [kpiStatusChanges, setKpiStatusChanges] = useState<KpiStatusChange[]>(
    [],
  );

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

  const saveSourceRecords = useCallback(
    (next: HrRecord[]) => {
      const cloned = cloneRecords(next);
      noteStatusShifts(sourceRecords, cloned);
      setSourceRecords(cloned);
    },
    [noteStatusShifts, sourceRecords],
  );

  const resetSourceRecords = useCallback(() => {
    const original = cloneRecords();
    noteStatusShifts(sourceRecords, original);
    setSourceRecords(original);
  }, [noteStatusShifts, sourceRecords]);

  const clearKpiStatusChanges = useCallback(() => {
    setKpiStatusChanges([]);
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
      saveSourceRecords,
      resetSourceRecords,
      kpiStatusChanges,
      clearKpiStatusChanges,
      records,
      dateRangeLabel: formatDateRange(filters.startMonth, filters.endMonth),
      departmentLabel: filters.department,
    };
  }, [
    filters,
    resetSourceRecords,
    saveSourceRecords,
    setDepartment,
    sourceRecords,
    kpiStatusChanges,
    clearKpiStatusChanges,
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
