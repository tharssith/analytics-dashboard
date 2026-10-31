"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { flushAllPersists } from "@/lib/persist-queue";
import { clearUploadDraft } from "@/lib/upload-draft";

const buttonClass =
  "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80";

export function LogoutButton() {
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={() => {
        void (async () => {
          await flushAllPersists();
          clearUploadDraft();
          await logoutAction();
        })();
      }}
    >
      <LogOut size={16} className="text-navy" />
      Log Out
    </button>
  );
}
