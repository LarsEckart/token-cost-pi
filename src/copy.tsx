/* Every English word on the page. */

import { GROUPS } from "./engine.ts"
import type { CostNode } from "./model.ts"

/** Which dialog the reader is about to meet. */
export type Os = "mac" | "win" | "linux"

/** One word of the card's heading, and the slot it occupies. */
export interface Word {
  w: string
  text: string
  em?: boolean
  /** No gap before this one. */
  tight?: boolean
}

const words = (value: Word[]) => value
const platformHelp = (value: Record<Os, React.ReactNode>) => value
const labelDictionary = (value: Record<string, string>) => value

const EN = {
  /* the toolbar */
  /** The bar folds into one button where there is no room for a row of them. */
  menu: { name: "Tools", close: "Close" },
  theme: {
    /** What the cycle picks, said in front of it where there is room for a word. */
    name: "Theme",
    light: "Light theme",
    system: "System theme",
    dark: "Dark theme",
    /** The hint on a control that shows one option and walks to the next: what pressing does,
     *  since which one is current is already the button's name. */
    cycle: (next: string): string => `Press to switch to: ${next}`,
  },
  mask: {
    name: "Hide dollar amounts",
    tipOn: "Show the dollars again",
    tipOff: "Cover every dollar figure, leaving shares of the bill — for sharing a screen",
  },
  reset: {
    name: "New analysis",
    tip: "Discard this report and pick different transcripts. Nothing was uploaded, so these numbers only exist in this page — they are gone once you do.",
  },
  share: {
    copy: "Copy chart",
    copyBusy: "Rendering…",
    copyDone: "Chart copied",
    copySaved: "Chart saved as a PNG",
    copyFailed: "Could not render the chart",
    to: "Share to",
    name: "Share to X",
    busy: "Rendering…",
    copied: "Image copied — paste it into the post",
    saved: "Image saved — attach it to the post",
    failed: "Could not render the image",
  },

  /* the card's header */
  card: {
    eyebrow: "Cost attribution · Pi",
    /** The browser tab title. */
    title: "Where the money went — Pi cost attribution",
    /** Read rather than dropped: this line stands over the figure on every device, and a phone
     *  has nothing to drop. Reading is what the page does with either way in. */
    nothingYet: "Nothing read yet",
    /** What goes between the heading's words: a space, or nothing in the scripts that set none. */
    gap: " ",
    billed: (masked: boolean): string => `Billed · ${masked ? "amount hidden" : "reported cost"}`,
    /** The question, before a folder has been dropped. */
    ask: words([
      { w: "where", text: "Where" },
      { w: "did", text: "did" },
      { w: "your", text: "your" },
      { w: "money", text: "money", em: true },
      { w: "go", text: "go?" },
    ]),
    /** And the answer. */
    answer: words([
      { w: "where", text: "Where" },
      { w: "your", text: "your" },
      { w: "money", text: "money", em: true },
      { w: "went", text: "went" },
    ]),
    scope: (sessions: string, days: number | null, requests: string): string =>
      [`${sessions} sessions`, days ? `${days} days` : null, `${requests} requests`]
        .filter(Boolean)
        .join(" · "),
  },

  /* the four figures that carry the thesis */
  strip: {
    thesis: (
      <>
        A <em>carry</em> bill, not a usage bill — every request re-bills the whole context.
      </>
    ),
    carried: (times: string): string => `Written once, carried ${times}`,
    split: (thinking: string): string => `Input vs output · thinking ${thinking}`,
    of: " of",
    theBill: "the bill",
    fixedMasked: (requests: string): string => `Fixed, paid on all ${requests} requests`,
    fixedOpen: (amount: string): string => `Fixed, every request · ${amount}`,
  },

  /* the picture, and the controls that pick it */
  chart: {
    panels: "Panels",
    table: "Table",
    mosaic: "Mosaic",
    sunburst: "Sunburst",
    breadcrumb: "Breadcrumb",
    all: "all",
    headMosaic: "Every line item · column width = share of bill · block height = share of column",
    /* The same two claims, for the narrow window where the chart is turned on its side. Both
       axes swap, so neither half of the sentence survives the rotation. */
    headMosaicRows: "Every line item · row height = share of bill · block width = share of row",
    headSun: "Every line item · arc = share of the ring inside it · each ring one level deeper",
    /* This keeps the central claim in one place, so the chart and footnotes do not drift. */
    hoverIdle: (gen: string, carry: string): string =>
      `Accented block = prose the model wrote once for ${gen}, re-billed as input for ${carry} more. ` +
      "Hover any block for its line item.",
    hoverLine: (name: string, amount: string, share: string, under: string): string =>
      `${name}   ${amount}   ${share} of ${under}`,
  },

  /* the sunburst's own furniture */
  sun: {
    back: "Back one level",
    goBack: "click to go back",
    drillIn: "click a sector to drill in",
    lineItems: (n: number): string => `${n} line items`,
    aria: (n: number, total: string): string =>
      `Sunburst: ${n} line items totalling ${total}, each ring a share of the one inside it`,
    empty: (label: string): string => `No further breakdown under ${label}.`,
    foldedNote: "the folded tail · shown whole, listed in the table",
    itemsNote: (n: number): string => `${n} item${n === 1 ? "" : "s"}`,
    leafNote: "single line item · no further breakdown",
    ofLabel: (share: React.ReactNode, label: string): React.ReactNode => (
      <>
        {share} of {label}
      </>
    ),
  },

  /* panels */
  panels: {
    leaf: "single line item · no further breakdown",
    shown: (shown: string, whole: string): string => `shown: ${shown} of ${whole}`,
    ofBill: (amount: string): string => `${amount} of bill`,
    perReq: (amount: string): string => `${amount}/req`,
  },

  /* the breakdown, and the table inside it */
  breakdown: {
    title: "Breakdown",
    find: "Find",
    findPlaceholder: "git diff, thinking, schema…",
    reconciled: "Reconciled",
    reconciledIs: (amount: React.ReactNode): React.ReactNode => (
      <>
        Reconciled: <strong>{amount}</strong>
      </>
    ),
    noteFiltered: (amount: string): string =>
      `Filtered view · ${amount} across matching line items, shown in their parents' context; ` +
      "parent rows keep their own full totals.",
    noteWhole: "Children sum to parent at every level; folded rows keep their full value.",
    noteGap: (gap: string): string => ` ${gap} of the billed total is unattributed rounding.`,
  },
  table: {
    lineItem: "Line item",
    cost: "Cost",
    share: "Share",
    magnitude: "Magnitude",
    perRequest: "Per request",
    shareOfBill: "Share of bill",
    matched: "Matched",
    noMatch: (query: string): string => `No line item matches “${query}”.`,
  },

  /* the footnotes */
  foot: {
    monday: "What to change on Monday",
    caveats: "Caveats",
    intake: (p: {
      ingest: string
      emit: string
      typed: string
      ratio: string | null
    }): React.ReactNode => (
      <>
        <strong>Cut the intake, not the output.</strong> {p.ingest} of the bill is content tools
        pulled <em>into</em> context, against {p.emit} of arguments sent out and {p.typed} for
        everything you typed
        {p.ratio ? ` (${p.ratio}× less)` : ""}. Tool output lands in the prefix whole and is
        re-billed until it falls out — ask for narrower slices.
      </>
    ),
    preamble: (fixed: string, requests: string): React.ReactNode => (
      <>
        <strong>Trim the preamble.</strong> {fixed} of fixed overhead is the only line you can
        delete once and stop paying {requests} times.
      </>
    ),
    compact: (
      <>
        <strong>Compact sooner.</strong> Carry cost is linear in how long a result survives, not in
        how big it looked.
      </>
    ),
    foldCaveat: (pct: string): string =>
      `Blocks under ${pct} of their parent are folded into a labelled “other”; nothing is dropped. ` +
      "Identity is carried by the table as well as by hue.",
  },

  /* the empty card */
  intake: {
    heading: (folder: React.ReactNode): React.ReactNode => <>Drop your {folder} folder here</>,
    /** The heading on a device that probably cannot reach the folder. It says what the page does
     *  rather than what to do next: a reader who has not been told what this is cannot be sent
     *  anywhere. Where to go is the note at the foot of the card. */
    headingTouch: "Visualize your AI bill",
    lede: "Chart your AI bill: every tool, every subcommand, every dollar.",
    /** The same line with the heading's words taken out of it, since the heading above now says
     *  them -- and with where the numbers come from put in, which is the other half of what this
     *  page is. */
    ledeTouch: "Every tool, every subcommand, every dollar, read out of your Pi sessions.",
    choose: "Choose folder",
    hidden: "The folder is hidden",
    /** The help a phone gets in place of the keystrokes: where to find the reader's own numbers.
     *  It is an instruction, not a claim about the device -- the page reads a pointer type and
     *  cannot see whether the folder is there. */
    yours: "To chart your own",
    yoursBody: (
      <>
        Open this page on the machine you run Pi on, and point it at{" "}
        <code>~/.pi/agent/sessions</code>.
      </>
    ),
    osTip: (current: string, next: string): string =>
      `Not ${current}? Press for the ${next} route.`,
    reading: "Reading",
    privacy: "Parsed in this page · nothing is uploaded",
    /** One line per platform, and it is the keystrokes rather than prose about them: this is
     *  read with a file dialog already open on top of it. */
    how: platformHelp({
      mac: (
        <>
          In the dialog press <kbd>⇧</kbd>
          <kbd>⌘</kbd>
          <kbd>.</kbd> to reveal hidden folders. Or <kbd>⇧</kbd>
          <kbd>⌘</kbd>
          <kbd>G</kbd> and paste <code>~/.pi/agent/sessions</code>.
        </>
      ),
      win: (
        <>
          Type <code>%USERPROFILE%\.pi\projects</code> into the dialog’s <em>Folder</em> box, press{" "}
          <kbd>Enter</kbd>.
        </>
      ),
      linux: (
        <>
          In the dialog press <kbd>Ctrl</kbd>
          <kbd>L</kbd>, type <code>~/.pi/agent/sessions</code>, press <kbd>Enter</kbd>.
        </>
      ),
    }),
    errNothing: "No files selected.",
    errNoJsonl: (root: React.ReactNode): React.ReactNode => (
      <>
        {root} holds no <code>.jsonl</code> transcripts. Pi writes one per session, under{" "}
        <code>~/.pi/agent/sessions</code>.
      </>
    ),
    errLoose: (n: number): React.ReactNode => (
      <>
        None of those {n} file(s) are <code>.jsonl</code> transcripts.
      </>
    ),
    errAnalysis: (message: string): string => `Analysis failed: ${message}`,
    errNoneBilled: (n: number, root: React.ReactNode | null): React.ReactNode => (
      <>
        Read {n} transcript{n > 1 ? "s" : ""} from {root ?? "that folder"}, and none of them holds a
        priced API request — nothing here has been billed.
      </>
    ),
    errNotPi: (n: number, root: React.ReactNode | null): React.ReactNode => (
      <>
        Those {n} <code>.jsonl</code> file{n > 1 ? "s" : ""} hold no priced API request.{" "}
        {root ? <>{root} is not</> : "They did not come from"} <code>~/.pi/agent/sessions</code>,
        which is where Pi keeps its transcripts.
      </>
    ),
  },

  /* the help under the empty card */
  where: {
    handingOver: "What you are handing over",
    handingOverBody: (
      <>
        One <code>.jsonl</code> file per session, in one folder per project, under{" "}
        <code>~/.pi/agent/sessions/</code> — a dotfile, which is why every file picker hides it
        until you ask for it by name. Everything you pick is combined into a single report, so pick
        one project’s folder if that is the bill you want.
      </>
    ),
    terminal: "Prefer the terminal?",
    terminalBody: (
      <>
        Open the folder in your file manager, then drag it onto the card above:{" "}
        <code>open ~/.pi/agent/sessions</code>
      </>
    ),
    noUpload: "Nothing is uploaded",
    noUploadBody:
      "The files are read and the bill worked out in this page: there is no server to send a " +
      "transcript to, and the build fails if anything in here reaches the network. Save the page " +
      "and it works the same from disk.",
    linkTitle: "A shared link carries the view, not the bill",
    linkBody:
      "The address records which lens and which block you are looking at — never the numbers. " +
      "Whoever opens it gets an empty card and drops their own transcripts in.",
  },

  /* The tree labels match the engine's stable names and the reader's source data. */
  labels: labelDictionary({
    all: "all",
    other: "other",
    "Shell commands": "Shell commands",
    "Tools · content read in": "Tools · content read in",
    "Tools · content written out": "Tools · content written out",
    "Tools · two-way": "Tools · two-way",
    "Model output": "Model output",
    "System prompt & tool schemas": "System prompt & tool schemas",
    "Harness & reminders": "Harness & reminders",
    "Images & attachments": "Images & attachments",
    "My typing": "My typing",
    Shell: "Shell",
    "Read in": "Read in",
    "Written out": "Written out",
    "Two-way": "Two-way",
    Output: "Output",
    "System prompt": "System prompt",
    Harness: "Harness",
    Media: "Media",
    "system prompt + tool schemas": "system prompt + tool schemas",
    harness: "harness",
    "your typed messages": "your typed messages",
    thinking: "thinking",
    "assistant prose (generated)": "assistant prose (generated)",
    "tool-call arguments": "tool-call arguments",
    "assistant prose (re-billed as input)": "assistant prose (re-billed as input)",
    "thinking blocks (re-billed as input)": "thinking blocks (re-billed as input)",
    "(output)": "(output)",
    "(no command parsed)": "(no command parsed)",
    "(no path parsed)": "(no path parsed)",
  }),
  /** The two suffixes the engine hangs off a tool's own name when both directions cost real
   *  money. */
  suffix: { results: "results", callArgs: "call args" },
  /** The folded tail, which is a count as much as a word. */
  folded: (n: number): string => `other (${n} items)`,
}

export type Dict = typeof EN

/** The English words used throughout the page. */
export function useT(): Dict {
  return EN
}

/* the names in the tree ---------- The engine's labels stay English inside the analysis: they
   key the palette, they are what `state.path` carries into the shared link, and one of them is
   what the mosaic and the sunburst test to find the block this page argues about. */

/** The two suffixes the engine hangs off a tool's own name when both directions cost real money. */
const SUFFIXES: ReadonlyArray<[string, (t: Dict) => string]> = [
  [" · results", (t) => t.suffix.results],
  [" · call args", (t) => t.suffix.callArgs],
]

export function labelOf(t: Dict, name: string): string {
  const known = t.labels[name]
  if (known !== undefined) return known
  for (const [suffix, word] of SUFFIXES)
    if (name.endsWith(suffix)) return `${labelOf(t, name.slice(0, -suffix.length))} · ${word(t)}`
  return name
}

/** A node as the reader should see it named. */
export function nodeName(t: Dict, n: CostNode): string {
  return n.folded ? t.folded(n.foldCount ?? 0) : labelOf(t, n.name)
}

/** The group whose rows are programs rather than tools. */
const SHELL = GROUPS.find((g) => g.id === "shell")?.name

/** Whether a name is text off the reader's own machine -- `git status`, `*.ts`, a path -- and so
 *  is set as code rather than as prose. */
export function isCode(t: Dict, name: string, under: string | null, group: string): boolean {
  if (t.labels[name] !== undefined) return false
  if (under !== null && under !== group && under !== name) return true
  return group === SHELL
}
