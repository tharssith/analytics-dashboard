"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/lib/filters-context";

export function AppErrorToast() {
  const { dataError, clearDataError } = useFilters();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!dataError) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 5000);
    const clear = window.setTimeout(() => clearDataError(), 5300);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [dataError, clearDataError]);

  if (!visible || !dataError) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 max-w-sm">
      <div className="rounded-md border-l-4 border-rag-red bg-white px-3 py-3 text-xs leading-5 text-foreground ring-1 ring-border">
        {dataError}
      </div>
    </div>
  );
}
