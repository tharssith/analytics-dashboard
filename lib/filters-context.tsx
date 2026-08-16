"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
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
  records: HrRecord[];
  dateRangeLabel: string;
  departmentLabel: string;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const value = useMemo(() => {
    const records = filterRecords(dataset.records, filters);
    return {
      filters,
      setFilters,
      setDepartment: (department: DepartmentFilter) => {
        setFilters((current) => ({ ...current, department }));
      },
      records,
      dateRangeLabel: formatDateRange(filters.startMonth, filters.endMonth),
      departmentLabel: filters.department,
    };
  }, [filters]);

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
