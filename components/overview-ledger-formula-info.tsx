"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { overviewLedgerTheme, type OverviewLedgerAccent } from "@/components/overview-ledger-ui";

type FormulaContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  accent: OverviewLedgerAccent;
  parts: string[];
  panelId: string;
  colSpan: number;
};

const FormulaContext = createContext<FormulaContextValue | null>(null);

function useFormulaContext() {
  const ctx = useContext(FormulaContext);
  if (!ctx) {
    throw new Error("Overview ledger formula components must be used within OverviewLedgerFormulaProvider");
  }
  return ctx;
}

function formulaParts(formula: string | string[]) {
  if (Array.isArray(formula)) return formula;
  return formula
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function OverviewLedgerFormulaProvider({
  accent,
  formula,
  colSpan,
  children,
}: {
  accent: OverviewLedgerAccent;
  formula: string | string[];
  colSpan: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const parts = useMemo(() => formulaParts(formula), [formula]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, accent, parts, panelId, colSpan }),
    [open, accent, parts, panelId, colSpan],
  );

  return <FormulaContext.Provider value={value}>{children}</FormulaContext.Provider>;
}

export function OverviewLedgerFormulaHeaderTrigger({ label }: { label: string }) {
  const { open, setOpen, accent, parts, panelId } = useFormulaContext();
  const infoBtn = overviewLedgerTheme(accent).infoBtn;

  if (parts.length === 0) {
    return <th className="px-3 py-3 sm:px-4">{label}</th>;
  }

  return (
    <th className="px-3 py-3 sm:px-4">
      <div className="flex items-center justify-end gap-2">
        <span>{label}</span>
        <button
          type="button"
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold leading-none transition-colors ${infoBtn}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="How this ledger is calculated"
          onClick={() => setOpen(!open)}
        >
          i
        </button>
      </div>
    </th>
  );
}

/** Inline formula panel — render immediately after `<thead>` inside the same `<table>`. */
export function OverviewLedgerFormulaStrip() {
  const { open, parts, panelId, colSpan } = useFormulaContext();

  if (!open || parts.length === 0) return null;

  return (
    <tbody className="bg-white">
      <tr>
        <td id={panelId} colSpan={colSpan} className="border-b border-line/80 bg-white px-4 py-3 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Formulas</p>
          <ul className="mt-2 space-y-2 text-xs leading-snug text-slate-700">
            {parts.map((part) => (
              <li key={part} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                <span>{part}</span>
              </li>
            ))}
          </ul>
        </td>
      </tr>
    </tbody>
  );
}
