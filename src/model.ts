/* The report's view model: everything that turns an `Analysis` into the rows, columns and
   numbers the components draw, with no React and no DOM in sight. */

import { GROUPS, type Dataset, type GroupId, type Insights } from "./engine.ts"
import { postCopy, type PostCopy } from "./post-copy.ts"

/* Every level of the tree -- group, item, child, and the synthetic "other" row folding produces
   -- is drawn by the same components, so they share one shape. */
export interface CostNode {
  name: string
  cost: number
  items?: CostNode[]
  children?: CostNode[] | null
  folded?: boolean
  /** How many rows the folded tail stands for. */
  foldCount?: number
  self?: boolean
  id?: GroupId
  shortName?: string
}

/** Rows below this share of their parent, or past this rank, become one labelled "other" row. */
export const FOLD_MIN = 0.008
export const FOLD_MAX = 14

/** Percentage of a maximum, guarded. */
export const percentageOf = (v: number, max: number): number =>
  max > 0 && v >= 0 ? (v / max) * 100 : 0

export const highestCost = (list: CostNode[] | null | undefined): number =>
  list && list.length ? Math.max(...list.map((x) => x.cost || 0)) : 0

/** Currency values use one fixed locale because the app only ships English copy. */
const fmt = (digits: number): Intl.NumberFormat =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const money = (n: number): string => fmt(2).format(n)

/** The same, at the precision the per-request figures want. */
export const moneyFine = (n: number, digits: number): string => fmt(digits).format(n)

export const count = (n: number): string => n.toLocaleString("en-US")

/** Keep the top items and fold the tail into one labelled row. */
export function foldSmallNodes(
  list: CostNode[] | null | undefined,
  parentCost: number,
  noFold?: boolean,
): CostNode[] {
  if (!list || !list.length) return []
  const sorted = list.slice().sort((a, b) => b.cost - a.cost)
  if (noFold) return sorted
  const keep: CostNode[] = [],
    rest: CostNode[] = []
  sorted.forEach((n, i) => (i < FOLD_MAX && n.cost >= parentCost * FOLD_MIN ? keep : rest).push(n))
  if (rest.length)
    keep.push({
      /* The name is an identifier here, not a label: it keys hover, transitions, and drill paths. */
      name: "other",
      cost: +rest.reduce((s, n) => s + n.cost, 0).toFixed(2),
      children: null,
      folded: true,
      foldCount: rest.length,
    })
  return keep
}

/** A node is only worth opening when it has child nodes to show. */
export function hasBranches(node: CostNode | null | undefined): boolean {
  const k = (node && (node.items || node.children)) || []
  return k.length > 1 || (k.length === 1 && (k[0].items || k[0].children || []).length > 1)
}

/** The same question, answered with the list: the children worth drawing as a level of their
 *  own, or null. */
export function childNodes(node: CostNode | null | undefined): CostNode[] | null {
  if (!node || !hasBranches(node)) return null
  return node.items || node.children || null
}

/* palette */

/** Colour follows the group's stable ID from the engine, in the engine's declared order -- so a
 *  group keeps its hue when you drill in or switch view, and a dataset
 *  containing tools this file has never heard of still colours consistently. */
export interface Palette {
  hue(group: string | null | undefined): string
  shortName(group: string): string | undefined
}

export function createPalette(dataset: Dataset): Palette {
  const hues = new Map<string, string>()
  const shortNames = new Map<string, string>()
  const order = GROUPS.map((group) => group.id)
  ;(dataset.groups || []).forEach((group) => {
    const index = order.indexOf(group.id)
    hues.set(group.name, index >= 0 && index < 8 ? `var(--c${index + 1})` : "var(--cn)")
    if (group.shortName) shortNames.set(group.name, group.shortName)
  })
  return {
    hue: (group) => (group && hues.get(group)) || "var(--cn)",
    shortName: (group) => shortNames.get(group),
  }
}

/* drill-down */

export interface Focus {
  node: CostNode
  groupName: string | null
}

/** A node name as it goes into the address. The names are prose -- "Tools · content read in",
 *  "assistant prose (generated)" -- and percent-escapes are not something to hand a reader.
 *  What goes is the punctuation and the spacing; letters are kept whatever their script, since a
 *  transcript is full of paths and commands this page did not choose the alphabet of. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "-"
  )
}

/** And back, against the tree on show: the slug drops the case and the punctuation, so the names
 *  it could have come from are the only place it can be read. One that names nothing at this
 *  level ends the path rather than being carried as a name no view will find. */
export function pathFromSlugs(dataset: Dataset, slugs: string[]): string[] {
  const group = dataset.groups.find((x) => slug(x.name) === slugs[0])
  if (!group) return []
  const it = slugs[1] ? (group.items || []).find((x) => slug(x.name) === slugs[1]) : null
  return it ? [group.name, it.name] : [group.name]
}

/** The subtree the page is currently focused on, from a breadcrumb path of at most two levels. */
export function focusForPath(dataset: Dataset, path: string[]): Focus {
  let node: CostNode = { name: "all", cost: dataset.total, items: dataset.groups }
  let group: CostNode | null = null
  if (path[0]) {
    const matchedGroup = dataset.groups.find((item) => item.name === path[0])
    if (matchedGroup) {
      group = matchedGroup
      node = {
        name: matchedGroup.name,
        cost: matchedGroup.cost,
        items: matchedGroup.items,
      }
    }
    if (path[1] && group) {
      const it = (group.items || []).find((x) => x.name === path[1])
      if (it) node = { name: it.name, cost: it.cost, items: it.children || [] }
    }
  }
  return { node, groupName: group ? group.name : null }
}

/* sunburst */

/** One node's slice of the circle. */
export interface SunArc {
  key: string
  name: string
  cost: number
  /** 0 is the innermost ring. */
  ring: number
  a0: number
  a1: number
  parentName: string | null
}

/** An innermost sector and everything beneath it. */
export interface SunBranch {
  key: string
  name: string
  group: string
  cost: number
  /** Line items under this sector *before* folding, so the legend can say how many there really
   *  are rather than how many remain after folding. */
  items: number
  /** True for the synthetic tail row: it stands for many line items, and saying it has none
   *  underneath would read as "this is one thing" when it is the opposite. */
  folded: boolean
  arcs: SunArc[]
}

export const SUN_RINGS = 3

/** A sector thinner than this many degrees is not subdivided. */
export const SUN_MIN_SPLIT = 4

/** Each node's share of the sweep it sits in. */
function shareIn(list: CostNode[]): (cost: number) => number {
  const total = list.reduce((s, n) => s + n.cost, 0)
  return total > 0 ? (c) => c / total : () => 1 / (list.length || 1)
}

/** Lay the focused subtree out as nested rings. */
export function sunburst(focus: Focus, rings: number = SUN_RINGS): SunBranch[] {
  const top = foldSmallNodes(focus.node.items || [], focus.node.cost || 1, !focus.groupName)
  const share = shareIn(top)
  const out: SunBranch[] = []
  let at = 0

  for (const n of top) {
    /* Colour is the group's, at every depth -- the whole branch is one hue getting lighter
       outward, so a ring reads as "more detail about this" and not as new information. */
    const group = focus.groupName || n.name
    const arcs: SunArc[] = []

    const walk = (
      node: CostNode,
      ring: number,
      a0: number,
      span: number,
      key: string,
      parentName: string | null,
    ): void => {
      arcs.push({ key, name: node.name, cost: node.cost, ring, a0, a1: a0 + span, parentName })
      if (ring + 1 >= rings || span < SUN_MIN_SPLIT) return
      const kids = foldSmallNodes(childNodes(node) || [], node.cost)
      if (!kids.length) return
      /* Scaled by what the children actually sum to, so the ring fills its parent's sweep even
         where rounding leaves the two a cent apart. */
      const kidShare = shareIn(kids)
      let a = a0
      for (const k of kids) {
        const s = kidShare(k.cost) * span
        walk(k, ring + 1, a, s, key + "›" + k.name, node.name)
        a += s
      }
    }

    const span = share(n.cost) * 360
    walk(n, 0, at, span, group + "›" + n.name, null)
    at += span
    out.push({
      key: group + "›" + n.name,
      name: n.name,
      group,
      cost: n.cost,
      items: (childNodes(n) || []).length,
      folded: !!n.folded,
      arcs,
    })
  }
  return out
}

/* ledger */

export interface LedgerRow {
  node: CostNode
  depth: number
  group: string | null
  key: string
  open: boolean
  hasChildren: boolean
  /** The hover key for this row, built the way the charts build theirs: `group›item` for a
   *  top-level row and `group›item›child` below it. */
  hoverKey: string
  /** What this row hangs under, or null at the top level. */
  parentName: string | null
}

export interface Ledger {
  rows: LedgerRow[]
  recon: number
  rootCost: number
}

/** Whether a ledger row is open, given the reader's toggles. */
export const rowIsOpen = (open: Record<string, boolean>, key: string, depth: number): boolean =>
  open[key] !== undefined ? open[key] : depth === 0

/** Flatten the focused subtree into ledger rows, honouring open state and the query. */
export function ledger(
  dataset: Dataset,
  path: string[],
  open: Record<string, boolean>,
  query: string,
): Ledger {
  const at = focusForPath(dataset, path)
  const q = query.trim().toLowerCase()
  const rows: LedgerRow[] = []
  let recon = 0

  const walk = (
    list: CostNode[],
    depth: number,
    inherit: string | null,
    parent: string | null,
  ): void => {
    const parentCost = list.reduce((s, n) => s + n.cost, 0) || 1
    foldSmallNodes(list, parentCost, depth === 0 && !at.groupName).forEach((n) => {
      const group = depth === 0 && !at.groupName ? n.name : inherit
      const kids = childNodes(n)
      const key = group + "›" + n.name + "›" + depth
      /* The disclosure key above is this table's own and carries the depth; the hover key is
         shared with the charts and carries the path, which is why they are not one string. */
      const hoverKey = parent ? `${group}›${parent}›${n.name}` : `${group}›${n.name}`
      const match = !q || n.name.toLowerCase().includes(q)
      const kidMatch = kids
        ? kids.some(
            (k) =>
              k.name.toLowerCase().includes(q) ||
              (k.children || []).some((child) => child.name.toLowerCase().includes(q)),
          )
        : false
      if (q && !match && !kidMatch) return
      const isOpen = q ? kidMatch || (match && depth === 0) : rowIsOpen(open, key, depth)
      if (q) {
        if (match && !(kids && kids.length && isOpen)) recon += n.cost
      } else if (depth === 0) recon += n.cost
      rows.push({
        node: n,
        depth,
        group: group,
        key,
        open: isOpen,
        hasChildren: !!(kids && kids.length),
        hoverKey,
        parentName: parent,
      })
      if (kids && kids.length && isOpen) walk(kids, depth + 1, group, n.name)
    })
  }

  walk(at.node.items || [], 0, at.groupName, null)
  return { rows, recon: +recon.toFixed(2), rootCost: at.node.cost || 1 }
}

/* the post */

/** How long a post can be before the composer starts refusing it. */
export const POST_MAX = 280

/** The characters X counts double: CJK ideographs, kana, hangul and the fullwidth forms. */
const WIDE = /[ᄀ-ᇿ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

/** X bills a link at 23 characters however long it is, so the ceiling is measured the way the
 *  composer measures it rather than on the raw string. */
export const postLength = (s: string): number =>
  [...s.replace(/https?:\/\/\S+/g, "x".repeat(23))].reduce(
    (n, ch) => n + (WIDE.test(ch) ? 2 : 1),
    0,
  )

/** Programs a caption is allowed to name out loud. */
export const PUBLIC_PROGS = new Set([
  "awk",
  "bash",
  "cargo",
  "cat",
  "cp",
  "curl",
  "diff",
  "docker",
  "du",
  "echo",
  "find",
  "gh",
  "git",
  "go",
  "grep",
  "head",
  "jq",
  "kubectl",
  "ls",
  "make",
  "mkdir",
  "mv",
  "node",
  "npm",
  "pnpm",
  "psql",
  "python",
  "python3",
  "rg",
  "rm",
  "rsync",
  "ruby",
  "rustc",
  "sed",
  "sh",
  "sort",
  "ssh",
  "tail",
  "tar",
  "terraform",
  "touch",
  "tr",
  "uniq",
  "wc",
  "which",
  "xargs",
  "yarn",
  "zsh",
])

/** Tools a caption may name out loud, for the same reason and with a sharper edge: an MCP tool
 *  is displayed as `server · tool`, and the server is the reader's own -- often the employer's
 *  name, or a product that has not shipped. */
export const PUBLIC_TOOLS = new Set([
  "Agent",
  "Bash",
  "BashOutput",
  "Edit",
  "ExitPlanMode",
  "Glob",
  "Grep",
  "KillShell",
  "MultiEdit",
  "NotebookEdit",
  "NotebookRead",
  "Read",
  "SlashCommand",
  "Task",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Write",
])

/** What a leaf is vouched for by, ignoring the direction suffix the engine adds when a tool
 *  earns two rows. */
export const vouched = (gid: GroupId, name: string): boolean =>
  gid === "shell"
    ? PUBLIC_PROGS.has(name)
    : PUBLIC_TOOLS.has(name.replace(/ · (results|call args)$/, ""))

/** A share said the way a caption needs it. */
const share = (cost: number, total: number): string => {
  const p = percentageOf(cost, total)
  return (p > 0 && p < 1 ? p.toFixed(1) : p.toFixed(0)) + "%"
}

/** What every caption draws on, gathered once so the variants below are only sentences. */
export interface Facts {
  dataset: Dataset
  amountsHidden: boolean
  /** The English sentences used in a shared post. */
  copy: PostCopy
  scope: string
  /** Nameable leaves from the tool-shaped groups, biggest first. */
  tools: CostNode[]
  /** The shell half of the same list: programs, biggest first. */
  programs: CostNode[]
  typedMessages: CostNode | null
  /** How many times the model's prose was re-billed as input for every dollar spent generating
   *  it. */
  carryMultiplier: number
  /** The insight lines, for the captions that quote one of them on its own. */
  insights: Insights
  /** What the model's own output cost, which the insights carry only in pieces. */
  outputCost: number
  /** Dollars of bill for every dollar of typing. */
  costPerTypedDollar: number
  formatAmount: (cost: number) => string
  outOf: (cost: number) => string
  /** Whether a figure survives being formatted. */
  isSayable: (cost: number) => boolean
  /** A share, or null where it rounds away to nothing. */
  formatShare: (cost: number) => string | null
  /** A cost divided n ways -- always null when covered, because a per-request figure is money
   *  whatever the toolbar says. */
  formatPerUnit: (cost: number, count: number) => string | null
}

function factsOf(dataset: Dataset, amountsHidden: boolean): Facts {
  const copy = postCopy()
  const formatAmount = (cost: number): string =>
    amountsHidden ? share(cost, dataset.total) : money(cost)
  const isSayable = (cost: number): boolean => /[1-9]/.test(formatAmount(cost))

  const leaves = (...ids: GroupId[]): CostNode[] =>
    dataset.groups
      .filter((group) => ids.includes(group.id))
      .flatMap((group) =>
        /* SAFETY: TreeItem has every CostNode field used by the report views. */ (
          group.items as CostNode[]
        ).filter((n) => vouched(group.id, n.name)),
      )
      .filter((n) => isSayable(n.cost))
      .sort((a, b) => b.cost - a.cost)

  const { generatedProse, carriedProse } = dataset.insights
  // SAFETY: A TreeGroup has every CostNode field the caption uses.
  const typedMessages =
    (dataset.groups.find((group) => group.id === "typed") as CostNode | undefined) || null
  return {
    dataset,
    amountsHidden,
    copy,
    scope: dataset.days
      ? copy.scopeDays(dataset.days)
      : copy.scopeSessions(dataset.sessions, count(dataset.sessions)),
    tools: leaves("shell", "ingest", "emit", "twoway"),
    programs: leaves("shell"),
    typedMessages,
    carryMultiplier: generatedProse > 0 && carriedProse > 0 ? carriedProse / generatedProse : 0,
    insights: dataset.insights,
    outputCost: dataset.groups.find((group) => group.id === "output")?.cost || 0,
    costPerTypedDollar:
      typedMessages && typedMessages.cost > 0 ? dataset.total / typedMessages.cost : 0,
    formatAmount,
    isSayable,
    outOf: (cost) =>
      amountsHidden
        ? copy.outOfMasked(share(cost, dataset.total))
        : copy.outOf(money(cost), money(dataset.total)),
    formatShare: (cost) => {
      const s = share(cost, dataset.total)
      return /[1-9]/.test(s) ? s : null
    },
    formatPerUnit: (cost, n) => {
      if (amountsHidden || !(n > 0)) return null
      const each = money(cost / n)
      return /[1-9]/.test(each) ? each : null
    },
  }
}

/** One caption: the body, and the verb that introduces the link. */
export interface Draft {
  lines: string[]
  cta: string
}

/** The variants, each returning null when the data cannot support it honestly rather than
 *  printing a hole. The first six carry one phrasing; the styles added after them carry two or
 *  three, so a style that keeps coming up does not arrive in the same words twice. */
const VARIANTS: ((facts: Facts) => Draft | Draft[] | null)[] = [
  /* A. The tool question. */
  (facts) => {
    const [a, b] = facts.tools
    if (!a) return null
    /* Covered, the scope has nowhere good to sit: "12% of it over 31 days" reads as a rate
       rather than as a share of one bill, and the image carries the span anyway. */
    return facts.copy.toolQuestion({
      name: a.name,
      amount: facts.formatAmount(a.cost),
      outOf: facts.outOf(a.cost),
      scope: facts.scope,
      masked: facts.amountsHidden,
      second: b ? b.name : null,
      secondAmount: b ? facts.formatAmount(b.cost) : "",
    })
  },

  /* B. The commands nobody prices. */
  (facts) => {
    if (facts.programs.length < 2) return null
    const [a, ...rest] = facts.programs.slice(0, 3)
    return facts.copy.commandCosts({
      name: a.name,
      amount: facts.formatAmount(a.cost),
      scope: facts.scope,
      masked: facts.amountsHidden,
      rest: rest.map((n) => ({ name: n.name, amount: facts.formatAmount(n.cost) })),
    })
  },

  /* C. The agent framing, and the one that is always viable: it asks nothing of the shape of the
     tree, so there is never a dataset with no caption to pick. */
  (facts) => {
    const typedShare = facts.typedMessages
      ? share(facts.typedMessages.cost, facts.dataset.total)
      : null
    return facts.copy.agentSummary({
      total:
        facts.amountsHidden || !facts.isSayable(facts.dataset.total)
          ? null
          : money(facts.dataset.total),
      scope: facts.scope,
      requests: count(facts.dataset.requests),
      typedShare: typedShare && /[1-9]/.test(typedShare) ? typedShare : null,
    })
  },

  /* D. The self-own. */
  (facts) => {
    if (
      !facts.typedMessages ||
      !facts.isSayable(facts.typedMessages.cost) ||
      percentageOf(facts.typedMessages.cost, facts.dataset.total) >= 5
    )
      return null
    return facts.copy.typedShare({ outOf: facts.outOf(facts.typedMessages.cost) })
  },

  /* E. Generation against carry, which is this page's whole thesis in one ratio. */
  (facts) => {
    if (facts.carryMultiplier < 2) return null
    const { generatedProse, carriedProse } = facts.dataset.insights
    const open = !facts.amountsHidden && facts.isSayable(generatedProse)
    return facts.copy.proseCarryRatio({
      times: `${facts.carryMultiplier.toFixed(0)}×`,
      generatedAmount: open ? money(generatedProse) : null,
      carriedAmount: open ? money(carriedProse) : "",
    })
  },

  /* F. The receipt: a statement where the others ask, so the rotation is not five questions in a
     trench coat. */
  (facts) => {
    const top = facts.dataset.groups[0]
    if (!top || !(facts.dataset.total > 0)) return null
    const heading = facts.copy.said[top.id] || top.name.toLowerCase()
    return facts.copy.billReceipt({
      total:
        facts.amountsHidden || !facts.isSayable(facts.dataset.total)
          ? null
          : money(facts.dataset.total),
      scope: facts.scope,
      said: heading.length > 44 ? heading.slice(0, 43).trimEnd() + "…" : heading,
      share: share(top.cost, facts.dataset.total),
    })
  },

  /* G. The figures with no sentence around them. */
  (facts) => {
    const top = facts.dataset.groups[0]
    const part = top && facts.formatShare(top.cost)
    if (!top || !part || !(facts.dataset.requests > 0)) return null
    return facts.copy.billFigures({
      total:
        facts.amountsHidden || !facts.isSayable(facts.dataset.total)
          ? null
          : money(facts.dataset.total),
      scope: facts.scope,
      requests: count(facts.dataset.requests),
      each: facts.formatPerUnit(facts.dataset.total, facts.dataset.requests),
      said: facts.copy.said[top.id] || top.name.toLowerCase(),
      share: part,
    })
  },

  /* H. What it costs by the day and by the keystroke, which is how a habit is priced. */
  (facts) => {
    const perDay =
      facts.dataset.days && facts.dataset.days > 1
        ? facts.formatPerUnit(facts.dataset.total, facts.dataset.days)
        : null
    if (!perDay || !facts.dataset.days) return null
    return facts.copy.dailyCost({
      perDay,
      perRequest: facts.formatPerUnit(facts.dataset.total, facts.dataset.requests),
      days: count(facts.dataset.days),
      requests: count(facts.dataset.requests),
    })
  },

  /* I. The ratio between the typing and everything the typing drags in -- the one figure that
     says the same thing covered as it does open, because it carries no unit. */
  (facts) => {
    if (
      !facts.typedMessages ||
      !(facts.costPerTypedDollar >= 4) ||
      !isFinite(facts.costPerTypedDollar)
    )
      return null
    return facts.copy.typedCostRatio({
      times: `${facts.costPerTypedDollar.toFixed(0)}×`,
      scope: facts.scope,
      requests: count(facts.dataset.requests),
    })
  },

  /* J. The thinking nobody reads and everybody buys. */
  (facts) => {
    const { reasoning } = facts.insights
    if (!(reasoning > 0) || !facts.isSayable(reasoning)) return null
    return facts.copy.reasoningCost({
      amount: facts.formatAmount(reasoning),
      share: facts.amountsHidden ? null : facts.formatShare(reasoning),
      scope: facts.scope,
      masked: facts.amountsHidden,
    })
  },

  /* K. The meter that is already running when you start typing. */
  (facts) => {
    const { fixedOverhead } = facts.insights
    if (!(fixedOverhead > 0) || !facts.isSayable(fixedOverhead) || !(facts.dataset.requests > 0))
      return null
    return facts.copy.fixedCost({
      amount: facts.formatAmount(fixedOverhead),
      requests: count(facts.dataset.requests),
      scope: facts.scope,
    })
  },

  /* L. The same carry as E, said as a confession rather than as a ratio. */
  (facts) => {
    const { carriedProse } = facts.insights
    if (!(carriedProse > 0) || !facts.isSayable(carriedProse)) return null
    return facts.copy.carriedProseCost({
      amount: facts.formatAmount(carriedProse),
      scope: facts.scope,
      masked: facts.amountsHidden,
    })
  },

  /* M. All promise and no figure, and viable against any dataset because it quotes none. */
  (facts) => facts.copy.contextThesis(),

  /* N. The bill as a bill: a column of lines, which is the shape a reader stops scrolling for. */
  (facts) => {
    const rows = facts.dataset.groups
      .filter((group) => facts.copy.said[group.id] && facts.isSayable(group.cost))
      .slice(0, 4)
      .map((group) => ({
        name: /* SAFETY: The preceding filter keeps only groups with a caption label. */ facts.copy
          .said[group.id] as string,
        amount: facts.formatAmount(group.cost),
      }))
    if (rows.length < 3) return null
    return facts.copy.billLines({ scope: facts.scope, rows })
  },

  /* O. Two halves of the bill nobody guesses the order of. */
  (facts) => {
    const { toolInput } = facts.insights
    if (!facts.isSayable(facts.outputCost) || !facts.isSayable(toolInput)) return null
    const higherAmount = Math.max(facts.outputCost, toolInput),
      lowerAmount = Math.min(facts.outputCost, toolInput)
    /* Too close together and "bigger" is a coin toss the reader was right to lose. */
    if (!(lowerAmount > 0) || higherAmount / lowerAmount < 1.2) return null
    return facts.copy.outputVsInput({
      wroteMore: facts.outputCost > toolInput,
      higherAmount: facts.formatAmount(higherAmount),
      lowerAmount: facts.formatAmount(lowerAmount),
    })
  },

  /* P. The winner named and nothing else, because the name is the joke. */
  (facts) => {
    const [a] = facts.programs
    if (!a) return null
    return facts.copy.topProgram({ name: a.name, amount: facts.formatAmount(a.cost) })
  },

  /* Q. The one that leaves the reader something to do. */
  (facts) => {
    const [a] = facts.tools
    if (!a) return null
    return facts.copy.inputOptimization({
      name: a.name,
      amount: facts.formatAmount(a.cost),
      scope: facts.scope,
      masked: facts.amountsHidden,
    })
  },

  /* R. A question with a reply in mind. */
  (facts) => facts.copy.replyPrompt(),
]

/** A draft as the composer will receive it, trimmed to fit. */
function assemble(draft: Draft, home?: string | null): string {
  const link = home ? [`${draft.cta}: ${home}`] : []
  /* Down to the hook alone, which for a one-line draft is the whole caption: stopping at two
     would send something that already fits to the truncator to have an ellipsis put on it. */
  for (let keep = draft.lines.length; keep >= 1; keep--) {
    const out = [...draft.lines.slice(0, keep), ...link].join("\n\n")
    if (postLength(out) <= POST_MAX) return out
  }
  /* Nothing left to drop: the hook itself is over the ceiling, which takes a leaf name long
     enough that no sentence built around it would have fitted. */
  const [hook] = draft.lines
  const room = POST_MAX - (link.length ? postLength(link[0]) + 2 : 0)
  return [hook.slice(0, Math.max(0, room - 1)).trimEnd() + "…", ...link].join("\n\n")
}

/** Every caption this dataset can honestly carry, in a stable order. */
export function postVariants(
  dataset: Dataset,
  amountsHidden: boolean,
  home?: string | null,
): string[] {
  const facts = factsOf(dataset, amountsHidden)
  return VARIANTS.flatMap((v) => v(facts) || []).map((draft) => assemble(draft, home))
}

/** The caption that travels with the shared image, drawn at random from the ones this dataset
 *  supports. */
export function postText(
  dataset: Dataset,
  amountsHidden: boolean,
  home?: string | null,
  pick: number = Math.random(),
): string {
  const all = postVariants(dataset, amountsHidden, home)
  const i = Math.min(all.length - 1, Math.max(0, Math.floor(pick * all.length)))
  return all[i]
}
