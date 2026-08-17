/* The primary view: one column per line item, width = share of the bill, stacked blocks inside =
   the item's own breakdown. */

import { memo, useMemo } from "react"
import { useReport } from "./context.ts"
import { isCode, labelOf, nodeName, pageCopy } from "./copy.tsx"
import { hasBranches, foldSmallNodes, childNodes, percentageOf, type CostNode } from "./model.ts"
import { hoverBind, useHover, useNarrow } from "./store.ts"

/** How much of its parent a block has to be worth before its name is written on it. Two numbers
 *  because the axis changes: 7% of a column is a readable band of a chart that is tall, while 7%
 *  of a transposed row is fifteen pixels of one that is not. */
const LABEL_MIN = { columns: 7, rows: 25 }

/** A column's blocks: its children, or one block standing for the column itself when it has no
 *  breakdown. */
function segmentsOf(node: CostNode): CostNode[] {
  const kids = childNodes(node)
  return kids
    ? foldSmallNodes(kids, node.cost)
    : [{ name: node.name, cost: node.cost, children: null, self: true }]
}

/* Memoised, and given the hover as two primitives rather than the target itself: `hit` is the
   hovered key when it falls inside this column and null when it does not. */
const Column = memo(function Column({
  node,
  groupName,
  cumulativeStart,
  cumulativeEnd,
  width,
  hit,
  anyHover,
  rows,
}: {
  node: CostNode
  groupName: string
  cumulativeStart: number
  cumulativeEnd: number
  width: number
  hit: string | null
  anyHover: boolean
  /** The chart is transposed: this is a row, and its head is a gutter down the left. */
  rows: boolean
}): React.JSX.Element {
  const { palette, focus, formatAmount, drillInto } = useReport()
  const t = pageCopy()
  const h = palette.hue(groupName)
  const key = groupName + "›" + node.name
  const dim = anyHover && !hit

  const segments = segmentsOf(node)
  const segmentTotal = segments.reduce((s, x) => s + x.cost, 0) || 1

  /* The 80% mark is the one cumulative number worth calling out: it says how few columns carry
     most of the bill. */
  const crosses80 = cumulativeStart < 80 && cumulativeEnd >= 80
  const cum = crosses80 ? "◂80%" : width < 0.075 ? "" : cumulativeEnd.toFixed(0) + "%"
  /* At the root a column is a group, and a group has a shorter label for narrow columns. */
  const shortName = focus.groupName ? undefined : palette.shortName(node.name)

  const bar = (
    <div className="colsegs">
      {segments.map((s, i) => {
        const share = s.cost / segmentTotal,
          pct = share * 100
        const segmentKey = key + "›" + s.name
        const active = hit === segmentKey || hit === key
        const named = pct > (rows ? LABEL_MIN.rows : LABEL_MIN.columns)
        /* Prose re-billed as input is the one block the page argues about, so it keeps full
           strength and a dashed edge while the rest of the column ramps down. */
        const carry = s.name.includes("re-billed")
        return (
          <button
            type="button"
            key={segmentKey}
            className="segb"
            title={`${nodeName(t, s)} · ${formatAmount(s.cost)}`}
            onClick={() => drillInto(node.name)}
            {...hoverBind({
              key: segmentKey,
              name: s.name,
              cost: s.cost,
              parentName: node.name,
              group: groupName,
            })}
            style={{
              flex: Math.max(share, 0.002),
              background: h,
              opacity: active || carry ? 1 : Math.max(0.42, 0.96 - i * 0.075),
              padding: named ? "4px 6px" : 0,
              filter: active ? "brightness(1.07)" : undefined,
              boxShadow: active ? "inset 0 0 0 2px var(--paper)" : undefined,
              outline: carry && !active ? "2px dashed var(--paper)" : undefined,
              outlineOffset: carry && !active ? "-4px" : undefined,
            }}
          >
            {named ? (
              <span className="sl" data-code={isCode(t, s.name, node.name, groupName) ? 1 : 0}>
                {nodeName(t, s)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )

  const head = (
    <button
      type="button"
      className="colhead"
      onClick={() => drillInto(node.name)}
      {...hoverBind({ key, name: node.name, cost: node.cost, parentName: null, group: groupName })}
    >
      <span
        className="cn"
        data-code={!shortName && isCode(t, node.name, null, groupName) ? 1 : 0}
        style={{ fontSize: width < 0.08 ? "10.5px" : "11.5px" }}
      >
        {shortName ? labelOf(t, shortName) : nodeName(t, node)}
      </span>
      <span className="cc">{formatAmount(node.cost)}</span>
      <span className="cp">
        <span>{(width * 100).toFixed(1)}%</span>
        <span className={crosses80 ? "cum80" : undefined}>{cum}</span>
      </span>
    </button>
  )

  return (
    <div
      className="col"
      data-dim={dim ? 1 : 0}
      data-flat={hasBranches(node) ? 0 : 1}
      style={{ flex: Math.max(width, 0.012) }}
    >
      {/* Swapped in the markup rather than with `order`, because the gutter really is read
          before the row it names -- and `order` would have left it after in the tab order. */}
      {rows ? head : null}
      {bar}
      {rows ? null : head}
    </div>
  )
})

export function Mosaic(): React.JSX.Element {
  const { focus } = useReport()
  const hover = useHover()
  const hoverKey = hover?.key ?? null
  const rootCost = focus.node.cost || 1
  /* Where the chart turns on its side -- see `[data-lay]` in the stylesheet for what that costs
     and what it buys. */
  const rows = useNarrow()

  /* Memoised so the folded nodes keep their identity when only the hover moved -- otherwise
     every column would get a fresh `node` prop and the memo above would never hit. */
  const columns = useMemo(
    () => foldSmallNodes(focus.node.items || [], rootCost, !focus.groupName),
    [focus, rootCost],
  )
  const colTotal = columns.reduce((s, n) => s + n.cost, 0) || 1

  let run = 0
  return (
    <div className="mosaicwrap" data-lay={rows ? "rows" : "columns"}>
      <div className="mosaic">
        {columns.map((n) => {
          const cumulativeStart = percentageOf(run, rootCost)
          run += n.cost
          const key = (focus.groupName || n.name) + "›" + n.name
          return (
            <Column
              key={n.name}
              node={n}
              groupName={focus.groupName || n.name}
              cumulativeStart={cumulativeStart}
              cumulativeEnd={percentageOf(run, rootCost)}
              width={n.cost / colTotal}
              hit={
                hoverKey && (hoverKey === key || hoverKey.startsWith(key + "›")) ? hoverKey : null
              }
              anyHover={!!hoverKey}
              rows={rows}
            />
          )
        })}
      </div>
    </div>
  )
}

/** The readout under the mosaic. */
export function HoverBar(): React.JSX.Element {
  const { state, palette, focus, formatAmount, dataset } = useReport()
  const t = pageCopy()
  const h = useHover()
  const rootCost = focus.node.cost || 1
  const share = h ? (rootCost > 0 ? h.cost / rootCost : 0) : 0
  const parentName = state.path.length
    ? labelOf(t, state.path[state.path.length - 1])
    : t.strip.theBill

  return (
    <div className="hoverbar">
      <span className="sw" style={{ background: h ? palette.hue(h.group) : "transparent" }} />
      <span className="txt" data-on={h ? 1 : 0}>
        {h
          ? t.chart.hoverLine(
              (h.parentName ? labelOf(t, h.parentName) + " › " : "") + labelOf(t, h.name),
              formatAmount(h.cost),
              (share * 100).toFixed(share < 0.01 ? 2 : 1) + "%",
              parentName,
            )
          : t.chart.hoverIdle(
              formatAmount(dataset.insights.generatedProse),
              formatAmount(dataset.insights.carriedProse),
            )}
      </span>
    </div>
  )
}
