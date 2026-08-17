/* Panels: one card per line item, with its own children ranked inside. */

import { memo, useMemo } from "react"
import { useReport } from "./context.ts"
import { isCode, nodeName, pageCopy } from "./copy.tsx"
import {
  foldSmallNodes,
  childNodes,
  highestCost,
  moneyFine,
  percentageOf,
  type CostNode,
} from "./model.ts"
import { vtName } from "./Motion.tsx"
import { hoverBind, useHover } from "./store.ts"

/* Memoised on the same two primitives the mosaic columns take: `hit` is the hovered key when it
   lands inside this panel, null otherwise. */
const Panel = memo(function Panel({
  panel,
  groupName,
  maxPanel,
  kids,
  hit,
  anyHover,
}: {
  panel: CostNode
  groupName: string
  maxPanel: number
  kids: CostNode[]
  hit: string | null
  anyHover: boolean
}): React.JSX.Element {
  const { state, palette, formatAmount, requestCount, drillInto } = useReport()
  const t = pageCopy()
  const h = palette.hue(groupName)
  const key = groupName + "›" + panel.name
  const dim = anyHover && !hit
  const maxKid = highestCost(kids)

  /* Two different footers, and the difference matters: a panel with no children is a genuine
     leaf, while one whose children sum short of it has been filtered by the query and must say
     so rather than appear to under-count. */
  const kidsAll = childNodes(panel) || []
  const shown = kids.reduce((a, childNode) => a + childNode.cost, 0)
  const foot = !kidsAll.length
    ? t.panels.leaf
    : Math.abs(shown - panel.cost) < 0.01
      ? ""
      : t.panels.shown(formatAmount(shown), formatAmount(panel.cost))

  /* Named for the filter transition -- see `vtName`. The key is the panel's identity rather than
     its place in the grid, which is the whole point: a query that removes the third panel moves
     the fourth into its slot, and a name that counted slots would morph one line item into a
     different one. */
  return (
    <div className="pan" style={vtName(key)}>
      <div className="pantop">
        {/* The group's colour, as a bar standing beside the name rather than a rule under it.
            Underlined, the name read as a link and the colour as its decoration; upright, the
            colour is a label on the panel and the name is left as a name. The geometry is the
            stylesheet's -- see `.pantop button`, which hangs the bar out into the panel's own
            padding so the title stays flush with the bar and the rows beneath it. Handed down
            as a custom property rather than as the border itself, because only the hue is the
            data's: a width written here would be a width the padding that offsets it cannot
            see. */}
        <button
          type="button"
          data-code={isCode(t, panel.name, null, groupName) ? 1 : 0}
          style={
            /* SAFETY: React's CSSProperties omits the custom CSS variable the stylesheet reads. */
            { "--hue": h, opacity: dim ? 0.55 : 1 } as React.CSSProperties
          }
          onClick={() => drillInto(panel.name)}
          {...hoverBind({
            key,
            name: panel.name,
            cost: panel.cost,
            parentName: null,
            group: groupName,
          })}
        >
          {nodeName(t, panel)}
        </button>
        <span className="pc">{formatAmount(panel.cost)}</span>
      </div>
      <div className="panbar">
        <span className="track">
          <span
            style={{
              width: `${Math.max(percentageOf(panel.cost, maxPanel), 0.8)}%`,
              background: h,
              opacity: dim ? 0.5 : 1,
            }}
          />
        </span>
        <span className="pr">
          {state.amountsHidden
            ? t.panels.ofBill(formatAmount(panel.cost))
            : t.panels.perReq(moneyFine(panel.cost / requestCount, 4))}
        </span>
      </div>
      <div className="panitems">
        {kids.map((childNode) => {
          const childKey = key + "›" + childNode.name
          const active = hit === childKey
          return (
            <div
              className="pi"
              key={childKey}
              style={vtName(childKey)}
              data-on={active ? 1 : 0}
              {...hoverBind({
                key: childKey,
                name: childNode.name,
                cost: childNode.cost,
                parentName: panel.name,
                group: groupName,
              })}
            >
              <button
                type="button"
                data-folded={childNode.folded ? 1 : 0}
                data-code={isCode(t, childNode.name, panel.name, groupName) ? 1 : 0}
                onClick={() => drillInto(panel.name)}
              >
                {nodeName(t, childNode)}
              </button>
              <span className="tk">
                <span
                  style={{
                    width: `${Math.max(percentageOf(childNode.cost, maxKid), 1)}%`,
                    background: h,
                    opacity: active ? 1 : 0.6,
                  }}
                />
              </span>
              <span className="pv">{formatAmount(childNode.cost)}</span>
            </div>
          )
        })}
      </div>
      {foot ? <div className="panfoot">{foot}</div> : null}
    </div>
  )
})

export function Panels(): React.JSX.Element {
  const { dataset, focus, state } = useReport()
  const hover = useHover()
  const hoverKey = hover?.key ?? null
  const query = state.query.trim().toLowerCase()
  const rootCost = focus.node.cost || 1

  /* Memoised for node identity, so a hover leaves the memoised panels' props untouched. */
  const { panels, maxPanel } = useMemo(() => {
    /* At the root the nine groups are shown whole -- they are the page's spine, and folding one
       away would hide a role rather than a long tail. */
    const src: CostNode[] = focus.groupName
      ? foldSmallNodes(focus.node.items || [], rootCost)
      : dataset.groups.slice().sort((a, b) => b.cost - a.cost)
    return {
      maxPanel: highestCost(src),
      panels: src
        .map((panelNode) => {
          const kids = foldSmallNodes(childNodes(panelNode) || [], panelNode.cost).filter(
            (childNode) =>
              !query ||
              childNode.name.toLowerCase().includes(query) ||
              panelNode.name.toLowerCase().includes(query),
          )
          return { panelNode, kids }
        })
        .filter(({ kids }) => !query || kids.length),
    }
  }, [dataset, focus, rootCost, query])

  return (
    <div className="panels">
      {panels.map(({ panelNode, kids }) => {
        const key = (focus.groupName || panelNode.name) + "›" + panelNode.name
        return (
          <Panel
            key={panelNode.name}
            panel={panelNode}
            groupName={focus.groupName || panelNode.name}
            maxPanel={maxPanel}
            kids={kids}
            hit={hoverKey && (hoverKey === key || hoverKey.startsWith(key + "›")) ? hoverKey : null}
            anyHover={!!hoverKey}
          />
        )
      })}
    </div>
  )
}
