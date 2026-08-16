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
  dataset,
  defaultFilters,
  filterRecords,
  formatDateRange,
} from "./data";
import type { DepartmentFilter, FilterState, HrRecord } from "./types";

type FiltersContextValue = {
  filters: FilterState;
  setFilters: (next: FilterState) => void;
  setDepartment: (department: DepartmentFilter) => void;
  sourceRecords: HrRecord[];
  saveSourceRecords: (next: HrRecord[]) => void;
  resetSourceRecords: () => void;
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

  const saveSourceRecords = useCallback((next: HrRecord[]) => {
    setSourceRecords(cloneRecords(next));
  }, []);

  const resetSourceRecords = useCallback(() => {
    setSourceRecords(cloneRecords());
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
