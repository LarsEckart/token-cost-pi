/* Shared report data and actions, derived once so each view reads the same state. */

import { createContext, useCallback, useContext, useMemo } from "react"
import type { Analysis, Dataset } from "./engine.ts"
import {
  createPalette,
  focusForPath,
  hasBranches,
  money,
  type Focus,
  type Palette,
} from "./model.ts"
import { disarmHover, setState, type ViewState } from "./store.ts"

export interface ReportContextValue {
  analysis: Analysis
  dataset: Dataset
  state: ViewState
  palette: Palette
  /** The subtree selected by the breadcrumb. */
  focus: Focus
  /** Format a cost as dollars or, when amounts are hidden, as a share of the supplied total. */
  formatAmount(cost: number, total?: number): string
  /** At least one, so per-request figures never divide by zero. */
  requestCount: number
  /** Open a child node when it has another level to show. */
  drillInto(name: string): void
}

export const ReportContext = createContext<ReportContextValue | null>(null)

export function useReport(): ReportContextValue {
  const context = useContext(ReportContext)
  if (!context) throw new Error("useReport() outside a report")
  return context
}

/** Derive the stable data and actions that every report view shares. */
export function useReportContext(
  analysis: Analysis | null,
  state: ViewState,
): ReportContextValue | null {
  const dataset = analysis?.dataset ?? null
  const requestCount = dataset?.requests || 1
  const focus = useMemo(
    () => (dataset ? focusForPath(dataset, state.path) : null),
    [dataset, state.path],
  )
  const palette = useMemo(() => (dataset ? createPalette(dataset) : null), [dataset])
  const totalCost = dataset?.total ?? 0

  const formatAmount = useCallback<ReportContextValue["formatAmount"]>(
    (cost, total) => {
      if (!state.amountsHidden) return money(cost)
      const denominator = total || totalCost
      const percentage = denominator > 0 ? (cost / denominator) * 100 : 0
      return (percentage < 1 ? percentage.toFixed(2) : percentage.toFixed(1)) + "%"
    },
    [state.amountsHidden, totalCost],
  )

  const drillInto = useCallback(
    (name: string) => {
      const child = (focus?.node.items || []).find((item) => item.name === name)
      if (!hasBranches(child)) return
      disarmHover()
      if (!focus?.groupName) setState({ path: [name] })
      else if (state.path.length === 1) setState({ path: [focus.groupName, name] })
    },
    [focus, state.path],
  )

  return useMemo(
    () =>
      analysis && dataset && focus && palette
        ? { analysis, dataset, state, palette, focus, requestCount, formatAmount, drillInto }
        : null,
    [analysis, dataset, state, palette, focus, requestCount, formatAmount, drillInto],
  )
}
