/* The ledger table. */

import { memo } from "react"
import { useReport } from "./context.ts"
import { isCode, nodeName, pageCopy } from "./copy.tsx"
import {
  highestCost,
  moneyFine,
  percentageOf,
  rowIsOpen,
  type LedgerRow,
  type Ledger,
} from "./model.ts"
import { vtName } from "./Motion.tsx"
import { hoverBind, setState, useHover } from "./store.ts"

/** What the footer claims, in words. */
export function useReconNote(ledger: Ledger): string {
  const { dataset, state, formatAmount } = useReport()
  const copy = pageCopy()
  if (state.query) return copy.breakdown.noteFiltered(formatAmount(ledger.recon))
  let s = copy.breakdown.noteWhole
  if (!state.path.length && Math.abs(dataset.total - ledger.recon) > 0.005) {
    const gap = state.amountsHidden
      ? (((dataset.total - ledger.recon) / dataset.total) * 100).toFixed(2) + "%"
      : moneyFine(dataset.total - ledger.recon, 2)
    s += copy.breakdown.noteGap(gap)
  }
  return s
}

/* One row, memoised on `active` rather than on the hover target, so moving the pointer down the
   table re-renders the row entered and the row left instead of all of them. */
const Row = memo(function Row({
  row,
  maxRow,
  rootCost,
  active,
}: {
  row: LedgerRow
  maxRow: number
  rootCost: number
  active: boolean
}): React.JSX.Element {
  const { state, palette, formatAmount, requestCount } = useReport()
  const copy = pageCopy()
  const hue = palette.hue(row.group)
  const pct = (row.node.cost / rootCost) * 100
  const name = (
    <span
      className="nm"
      data-folded={row.node.folded ? 1 : 0}
      data-code={isCode(copy, row.node.name, row.parentName, row.group || "") ? 1 : 0}
    >
      {nodeName(copy, row.node)}
    </span>
  )

  return (
    <tr
      className={`d${row.depth}`}
      style={vtName(row.key)}
      data-on={active ? 1 : 0}
      {...hoverBind({
        key: row.hoverKey,
        name: row.node.name,
        cost: row.node.cost,
        parentName: row.parentName,
        group: row.group || "",
      })}
    >
      <td className="name">
        <span className="namecell">
          <span
            className="chip"
            style={{
              width: row.depth ? 6 : 10,
              height: row.depth ? 6 : 10,
              background: hue,
              marginLeft: row.depth * 16,
              borderRadius: row.depth ? "50%" : 0,
            }}
          />
          {row.hasChildren ? (
            <button
              type="button"
              className="tog"
              aria-expanded={row.open}
              onClick={() =>
                setState({
                  open: { ...state.open, [row.key]: !rowIsOpen(state.open, row.key, row.depth) },
                })
              }
            >
              <span className="caret">{row.open ? "–" : "+"}</span>
              {name}
            </button>
          ) : (
            <span className="tog">
              <span className="caret" />
              {name}
            </span>
          )}
        </span>
      </td>
      <td className="num">{formatAmount(row.node.cost)}</td>
      <td className="pct">{pct.toFixed(pct < 1 ? 2 : 1)}%</td>
      <td>
        <span
          className="magbar"
          style={{
            height: row.depth ? 5 : 9,
            width: `${Math.max(percentageOf(row.node.cost, maxRow), 0.6)}%`,
            background: hue,
            opacity: active ? 1 : 0.55,
          }}
        />
      </td>
      <td className="per">
        {state.amountsHidden
          ? formatAmount(row.node.cost)
          : moneyFine(row.node.cost / requestCount, 4)}
      </td>
    </tr>
  )
})

export function LedgerTable({ ledger }: { ledger: Ledger }): React.JSX.Element {
  const { state, formatAmount } = useReport()
  const copy = pageCopy()
  const hover = useHover()
  const hoverKey = hover?.key ?? null
  const maxRow = highestCost(ledger.rows.filter((row) => row.depth === 0).map((row) => row.node))
  const reconShare = ledger.recon / ledger.rootCost

  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th scope="col" className="l">
              {copy.table.lineItem}
            </th>
            <th scope="col" className="r" style={{ width: 110 }}>
              {copy.table.cost}
            </th>
            <th scope="col" className="r" style={{ width: 78 }}>
              {copy.table.share}
            </th>
            <th scope="col" className="l" style={{ width: 230 }}>
              {copy.table.magnitude}
            </th>
            <th scope="col" className="last" style={{ width: 110 }}>
              {state.amountsHidden ? copy.table.shareOfBill : copy.table.perRequest}
            </th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.length ? (
            ledger.rows.map((row) => (
              <Row
                key={row.key}
                row={row}
                maxRow={maxRow}
                rootCost={ledger.rootCost}
                active={hoverKey === row.hoverKey || !!hoverKey?.startsWith(row.hoverKey + "›")}
              />
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ padding: "14px 0", color: "var(--ink3)" }}>
                {copy.table.noMatch(state.query)}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="lbl">{state.query ? copy.table.matched : copy.breakdown.reconciled}</td>
            <td className="v">{formatAmount(ledger.recon)}</td>
            <td className="p">{(reconShare * 100).toFixed(reconShare < 0.1 ? 2 : 1)}%</td>
            {/* The sentence lives in `.reconline` directly below, which is where it has to
                live anyway -- the panels view has no table to put a footer in -- so printing
                it here as well was the same paragraph twice, ten pixels apart. */}
            <td colSpan={2} className="n" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
