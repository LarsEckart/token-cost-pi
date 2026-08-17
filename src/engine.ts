/* Cost attribution engine for Pi session files. */

export interface RawFile {
  name: string
  text: string
}

export type GroupId =
  | "shell"
  | "ingest"
  | "emit"
  | "twoway"
  | "output"
  | "preamble"
  | "harness"
  | "media"
  | "typed"

export interface GroupDef {
  id: GroupId
  name: string
  shortName: string
}

export const GROUPS: GroupDef[] = [
  { id: "shell", name: "Shell commands", shortName: "Shell" },
  { id: "ingest", name: "Tools · content read in", shortName: "Read in" },
  { id: "emit", name: "Tools · content written out", shortName: "Written out" },
  { id: "twoway", name: "Tools · two-way", shortName: "Two-way" },
  { id: "output", name: "Model output", shortName: "Output" },
  { id: "preamble", name: "Pi context & tool schemas", shortName: "Pi context" },
  { id: "harness", name: "Compaction & extensions", shortName: "Compaction" },
  { id: "media", name: "Images & attachments", shortName: "Media" },
  { id: "typed", name: "My typing", shortName: "My typing" },
]

export interface TreeChild {
  name: string
  cost: number
}

export interface TreeItem {
  name: string
  cost: number
  children: TreeChild[] | null
}

export interface TreeGroup {
  id: GroupId
  name: string
  shortName: string
  cost: number
  items: TreeItem[]
}

export interface Insights {
  fixedOverhead: number
  reasoning: number
  generatedProse: number
  carriedProse: number
  toolInput: number
  toolOutput: number
  typedMessages: number
}

export interface Dataset {
  total: number
  input: number
  output: number
  requests: number
  sessions: number
  days: number | null
  groups: TreeGroup[]
  insights: Insights
}

export interface Analysis {
  dataset: Dataset
  filesUsed: number
  warnings: string[]
}

type Direction = "call" | "result"
type Role = "typed" | "tool" | "assistant" | "harness" | "preamble" | "image"

interface Bucket {
  role: Role
  name?: string
  direction?: Direction
  sub?: string | null
  shell?: boolean
  kind?: string
}

interface Row {
  bucket: Bucket
  cost: number
}

interface Usage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  cost?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
    total?: number
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonRecord

interface JsonRecord {
  [key: string]: JsonValue
}

interface ContentBlock {
  type?: string
  text?: string
  thinking?: string
  data?: string
  mimeType?: string
  name?: string
  id?: string
  arguments?: JsonValue
}

interface AgentMessage {
  role?: string
  content?: string | ContentBlock[]
  usage?: Usage
  toolCallId?: string
  toolName?: string
}

interface Entry {
  type?: string
  id?: string
  parentId?: string | null
  timestamp?: string
  message?: AgentMessage
  summary?: string
  retainedTail?: AgentMessage[]
  usage?: Usage
  customType?: string
  content?: string | ContentBlock[]
}

interface Contribution {
  bucket: Bucket
  tokens: number
}

interface Shell {
  shell: boolean
  sub: string | null
}

interface UsageCost {
  input: number
  output: number
  total: number
}

interface ToolRef {
  name: string
  shell: boolean
  sub: string | null
}

interface Scan {
  /** Costs are combined as they are found, so a large corpus never holds one row per request. */
  rows: Map<string, Row>
  seen: Set<string>
  input: number
  output: number
  requests: number
  sessions: number
  filesUsed: number
  duplicatesDropped: number
  badLines: number
  spanFrom: number | null
  spanTo: number | null
}

export interface Walk {
  scan: Scan
}

const round = (value: number): number => Math.round(value * 100) / 100
const sum = (values: Iterable<number>): number => {
  let total = 0
  for (const value of values) total += value
  return total
}
const textTokens = (text: string): number => Math.max(0, text.length / 4)
const bucketKey = (bucket: Bucket): string =>
  [
    bucket.role,
    bucket.name || "",
    bucket.direction || "",
    bucket.sub || "",
    bucket.shell ? "1" : "",
    bucket.kind || "",
  ].join("\u0000")

function addRow(scan: Scan, bucket: Bucket, cost: number): void {
  if (!(cost > 0)) return
  const key = bucketKey(bucket)
  const row = scan.rows.get(key)
  if (row) row.cost += cost
  else scan.rows.set(key, { bucket, cost })
}

function emptyScan(): Scan {
  return {
    rows: new Map(),
    seen: new Set(),
    input: 0,
    output: 0,
    requests: 0,
    sessions: 0,
    filesUsed: 0,
    duplicatesDropped: 0,
    badLines: 0,
    spanFrom: null,
    spanTo: null,
  }
}

function isString(value: JsonValue | undefined): value is string {
  return Object.prototype.toString.call(value) === "[object String]"
}

function isNumber(value: JsonValue | undefined): value is number {
  return Object.prototype.toString.call(value) === "[object Number]"
}

function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  return !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]"
}

function stringAt(record: JsonRecord, key: string): string | undefined {
  const value = record[key]
  return isString(value) ? value : undefined
}

function numberAt(record: JsonRecord, key: string): number | undefined {
  const value = record[key]
  return isNumber(value) ? value : undefined
}

function contentBlock(value: JsonValue): ContentBlock | null {
  if (!isJsonRecord(value)) return null
  return {
    type: stringAt(value, "type"),
    text: stringAt(value, "text"),
    thinking: stringAt(value, "thinking"),
    data: stringAt(value, "data"),
    mimeType: stringAt(value, "mimeType"),
    name: stringAt(value, "name"),
    id: stringAt(value, "id"),
    arguments: value.arguments,
  }
}

function blocksAt(record: JsonRecord, key: string): ContentBlock[] | undefined {
  const value = record[key]
  if (!Array.isArray(value)) return undefined
  return value.flatMap((block) => {
    const decoded = contentBlock(block)
    return decoded ? [decoded] : []
  })
}

function usageAt(record: JsonRecord): Usage | undefined {
  const value = record.usage
  if (!isJsonRecord(value)) return undefined
  const cost = isJsonRecord(value.cost)
    ? {
        input: numberAt(value.cost, "input"),
        output: numberAt(value.cost, "output"),
        cacheRead: numberAt(value.cost, "cacheRead"),
        cacheWrite: numberAt(value.cost, "cacheWrite"),
        total: numberAt(value.cost, "total"),
      }
    : undefined
  return {
    input: numberAt(value, "input"),
    output: numberAt(value, "output"),
    cacheRead: numberAt(value, "cacheRead"),
    cacheWrite: numberAt(value, "cacheWrite"),
    cost,
  }
}

function messageFrom(value: JsonValue | undefined): AgentMessage | undefined {
  if (!isJsonRecord(value)) return undefined
  const content = value.content
  return {
    role: stringAt(value, "role"),
    content: isString(content) ? content : blocksAt(value, "content"),
    usage: usageAt(value),
    toolCallId: stringAt(value, "toolCallId"),
    toolName: stringAt(value, "toolName"),
  }
}

function entryFrom(value: JsonValue): Entry | null {
  if (!isJsonRecord(value)) return null
  const retained = Array.isArray(value.retainedTail)
    ? value.retainedTail.flatMap((item) => {
        const message = messageFrom(item)
        return message ? [message] : []
      })
    : undefined
  const content = value.content
  return {
    type: stringAt(value, "type"),
    id: stringAt(value, "id"),
    parentId: stringAt(value, "parentId") ?? (value.parentId === null ? null : undefined),
    timestamp: stringAt(value, "timestamp"),
    message: messageFrom(value.message),
    summary: stringAt(value, "summary"),
    retainedTail: retained,
    usage: usageAt(value),
    customType: stringAt(value, "customType"),
    content: isString(content) ? content : blocksAt(value, "content"),
  }
}

function contentBlocks(content: AgentMessage["content"] | Entry["content"]): ContentBlock[] {
  if (Array.isArray(content)) return content
  return content ? [{ type: "text", text: content }] : []
}

function blockTokens(block: ContentBlock): number {
  if (block.type === "image") return 1000
  if (block.type === "toolCall") return textTokens(JSON.stringify(block.arguments || {}))
  return textTokens(block.text || block.thinking || block.data || "")
}

function shellOf(arguments_: JsonValue | undefined): Shell {
  if (!arguments_ || !isJsonRecord(arguments_)) return { shell: false, sub: null }
  const command = ["command", "cmd", "script", "shell_command"]
    .map((key) => arguments_[key])
    .find((value): value is string => isString(value) && !!value.trim())
  if (!command) return { shell: false, sub: null }
  const segment = command
    .split(/(?:&&|\|\||[|;\n])/)[0]
    .trim()
    .replace(/^(?:[A-Za-z_]\w*=\S*\s+)*/, "")
  const words = segment.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g) || []
  const wrappers = new Set(["env", "sudo", "command", "timeout", "nice", "stdbuf"])
  let at = 0
  while (wrappers.has(words[at]) || words[at]?.startsWith("-")) at++
  const program = (words[at] || "(no command)").split("/").pop() || "(no command)"
  const verb = words
    .slice(at + 1)
    .find((word) => /^[a-z][a-z0-9_-]*$/i.test(word) && !word.startsWith("-"))
  return { shell: true, sub: verb ? `${program} ${verb}` : program }
}

function usageCost(usage: Usage | undefined): UsageCost {
  const cost = usage?.cost
  if (!cost) return { input: 0, output: 0, total: 0 }
  const input = (cost.input || 0) + (cost.cacheRead || 0) + (cost.cacheWrite || 0)
  const output = cost.output || 0
  return { input, output, total: cost.total ?? input + output }
}

function bucketContributions(entry: Entry, toolRefs: Map<string, ToolRef>): Contribution[] {
  const message = entry.message
  if (!message) {
    if (entry.type === "compaction") {
      const summary = entry.summary || ""
      return summary
        ? [{ bucket: { role: "harness", name: "compaction summary" }, tokens: textTokens(summary) }]
        : []
    }
    if (entry.type === "branch_summary")
      return [
        {
          bucket: { role: "harness", name: "branch summary" },
          tokens: textTokens(entry.summary || ""),
        },
      ]
    if (entry.type === "custom_message") {
      const name = entry.customType || "extension message"
      return contentBlocks(entry.content).map((block) => ({
        bucket: { role: "harness", name },
        tokens: blockTokens(block),
      }))
    }
    return []
  }

  if (message.role === "user")
    return contentBlocks(message.content).map((block) => ({
      bucket: block.type === "image" ? { role: "image", kind: "image" } : { role: "typed" },
      tokens: blockTokens(block),
    }))

  if (message.role === "assistant") {
    const out: Contribution[] = []
    for (const block of contentBlocks(message.content)) {
      if (block.type === "thinking")
        out.push({
          bucket: { role: "assistant", kind: "thinking-carried" },
          tokens: blockTokens(block),
        })
      else if (block.type === "toolCall") {
        const key = shellOf(block.arguments)
        const name = block.name || "(unnamed tool)"
        if (block.id) toolRefs.set(block.id, { name, ...key })
        out.push({
          bucket: { role: "tool", name, direction: "call", sub: key.sub, shell: key.shell },
          tokens: blockTokens(block),
        })
      } else
        out.push({
          bucket: { role: "assistant", kind: "prose-carried" },
          tokens: blockTokens(block),
        })
    }
    return out
  }

  if (message.role === "toolResult") {
    const ref = toolRefs.get(message.toolCallId || "") || {
      name: message.toolName || "(unmatched tool result)",
      shell: false,
      sub: null,
    }
    return contentBlocks(message.content).map((block) => ({
      bucket:
        block.type === "image"
          ? { role: "image", kind: "image" }
          : { role: "tool", name: ref.name, direction: "result", sub: ref.sub, shell: ref.shell },
      tokens: blockTokens(block),
    }))
  }
  return []
}

type Context = Map<string, Contribution>

function addContributions(context: Context, parts: readonly Contribution[]): void {
  for (const part of parts) {
    if (!(part.tokens > 0)) continue
    const key = bucketKey(part.bucket)
    const prior = context.get(key)
    if (prior) prior.tokens += part.tokens
    else context.set(key, { bucket: part.bucket, tokens: part.tokens })
  }
}

/** A request only needs the combined token share for each bucket, not every prior message. */
function contextBefore(
  entry: Entry,
  entries: Map<string, Entry>,
  toolRefs: Map<string, ToolRef>,
  memo: Map<string, Context>,
): Context {
  const stateAt = (id: string): Context => {
    const known = memo.get(id)
    if (known) return known
    const node = entries.get(id)
    if (!node) return new Map()
    const parent = node.parentId ? stateAt(node.parentId) : new Map()
    const state: Context = node.type === "compaction" ? new Map() : new Map(parent)
    addContributions(state, bucketContributions(node, toolRefs))
    if (node.type === "compaction")
      for (const retained of node.retainedTail || [])
        addContributions(
          state,
          bucketContributions({ type: "message", message: retained }, toolRefs),
        )
    memo.set(id, state)
    return state
  }
  return entry.parentId ? stateAt(entry.parentId) : new Map()
}

function addInput(scan: Scan, amount: number, tokens: number, context: Context): void {
  if (!(amount > 0)) return
  const measured = sum([...context.values()].map((part) => part.tokens))
  const actual = tokens > 0 ? tokens : measured
  const known = Math.min(measured, actual)
  if (known > 0) {
    for (const part of context.values()) addRow(scan, part.bucket, (amount * part.tokens) / actual)
  }
  if (actual > known)
    addRow(
      scan,
      { role: "preamble", name: "Pi system prompt & tool schemas" },
      amount * ((actual - known) / actual),
    )
  if (!(actual > 0))
    addRow(scan, { role: "preamble", name: "Pi system prompt & tool schemas" }, amount)
}

function addOutput(scan: Scan, amount: number, message: AgentMessage): void {
  if (!(amount > 0)) return
  const blocks = contentBlocks(message.content)
  const parts: Array<{ bucket: Bucket; tokens: number }> = []
  for (const block of blocks) {
    if (block.type === "thinking")
      parts.push({ bucket: { role: "assistant", kind: "thinking" }, tokens: blockTokens(block) })
    else if (block.type === "toolCall")
      parts.push({
        bucket: { role: "assistant", kind: "tool-call arguments" },
        tokens: blockTokens(block),
      })
    else
      parts.push({
        bucket: { role: "assistant", kind: "assistant prose (generated)" },
        tokens: blockTokens(block),
      })
  }
  const total = sum(parts.map((part) => part.tokens))
  if (!(total > 0)) {
    addRow(scan, { role: "assistant", kind: "thinking" }, amount)
    return
  }
  for (const part of parts) addRow(scan, part.bucket, (amount * part.tokens) / total)
}

function scanFile(scan: Scan, file: RawFile): void {
  const parsed: Entry[] = []
  let headerId = ""
  /* Avoid `split`, which doubles the live memory of a large session before it is even parsed. */
  for (let from = 0; from < file.text.length;) {
    let end = file.text.indexOf("\n", from)
    if (end === -1) end = file.text.length
    const line = file.text.slice(from, end)
    from = end + 1
    if (!line.trim()) continue
    try {
      // SAFETY: JSON.parse returns only JSON values before entryFrom decodes the record shape.
      const entry = entryFrom(JSON.parse(line) as JsonValue)
      if (!entry) {
        scan.badLines++
        continue
      }
      if (entry.type === "session" && entry.id) headerId = entry.id
      parsed.push(entry)
    } catch {
      scan.badLines++
    }
  }
  const identity = headerId || `${file.name}:${file.text.length}`
  if (scan.seen.has(identity)) {
    scan.duplicatesDropped++
    return
  }
  scan.seen.add(identity)
  scan.filesUsed++

  const entries = new Map<string, Entry>()
  for (const entry of parsed) {
    if (entry.id) entries.set(entry.id, entry)
  }
  const toolRefs = new Map<string, ToolRef>()
  for (const entry of parsed) {
    if (entry.message?.role !== "assistant") continue
    for (const block of contentBlocks(entry.message.content)) {
      if (block.type === "toolCall" && block.id) {
        const tool = shellOf(block.arguments)
        toolRefs.set(block.id, { name: block.name || "(unnamed tool)", ...tool })
      }
    }
  }

  const contexts = new Map<string, Context>()
  let hasRequest = false
  for (const entry of parsed) {
    const ms = Date.parse(entry.timestamp || "")
    if (!Number.isNaN(ms)) {
      scan.spanFrom = scan.spanFrom === null ? ms : Math.min(scan.spanFrom, ms)
      scan.spanTo = scan.spanTo === null ? ms : Math.max(scan.spanTo, ms)
    }
    const message = entry.message
    if (!message) {
      const cost = usageCost(entry.usage)
      if (cost.total > 0) {
        addRow(
          scan,
          {
            role: "harness",
            name:
              entry.type === "compaction" ? "compaction generation" : "branch-summary generation",
          },
          cost.total,
        )
        scan.input += cost.input
        scan.output += cost.output
      }
      continue
    }
    if (message.role === "assistant") {
      const cost = usageCost(message.usage)
      if (cost.total > 0) {
        hasRequest = true
        scan.requests++
        const inputTokens =
          (message.usage?.input || 0) +
          (message.usage?.cacheRead || 0) +
          (message.usage?.cacheWrite || 0)
        addInput(scan, cost.input, inputTokens, contextBefore(entry, entries, toolRefs, contexts))
        addOutput(scan, cost.output, message)
        scan.input += cost.input
        scan.output += cost.output
      }
    } else {
      const nested = usageCost(message.usage)
      if (nested.total > 0) {
        const ref = toolRefs.get(message.toolCallId || "") || {
          name: message.toolName || "(tool)",
          shell: false,
          sub: null,
        }
        addRow(
          scan,
          { role: "tool", name: ref.name, direction: "result", sub: ref.sub, shell: ref.shell },
          nested.total,
        )
        scan.input += nested.input
        scan.output += nested.output
      }
    }
  }
  if (hasRequest) scan.sessions++
}

function makeDataset(scan: Scan): Dataset {
  const bucket = new Map<GroupId, Map<string, { cost: number; children: Map<string, number> }>>()
  const put = (id: GroupId, name: string, child: string | null, cost: number): void => {
    if (!(cost > 0)) return
    let items = bucket.get(id)
    if (!items) bucket.set(id, (items = new Map()))
    let item = items.get(name)
    if (!item) items.set(name, (item = { cost: 0, children: new Map() }))
    item.cost += cost
    if (child) item.children.set(child, (item.children.get(child) || 0) + cost)
  }
  const tools = new Map<
    string,
    { call: number; result: number; shell: boolean; subs: Map<string, number> }
  >()
  for (const row of scan.rows.values()) {
    const { bucket: b, cost } = row
    if (b.role === "tool") {
      const name = b.name || "(unnamed tool)"
      let tool = tools.get(name)
      if (!tool) tools.set(name, (tool = { call: 0, result: 0, shell: false, subs: new Map() }))
      tool[b.direction === "call" ? "call" : "result"] += cost
      tool.shell ||= !!b.shell
      if (b.sub) tool.subs.set(b.sub, (tool.subs.get(b.sub) || 0) + cost)
    } else if (b.role === "assistant") put("output", b.kind || "model output", null, cost)
    else if (b.role === "typed") put("typed", "your typed messages", null, cost)
    else if (b.role === "harness") put("harness", b.name || "Pi harness", null, cost)
    else if (b.role === "preamble")
      put("preamble", b.name || "Pi system prompt & tool schemas", null, cost)
    else if (b.role === "image")
      put("media", b.kind === "image" ? "images / screenshots" : "attachments", null, cost)
  }
  for (const [name, tool] of tools) {
    const total = tool.call + tool.result
    const share = total > 0 ? tool.result / total : 0
    const id: GroupId = tool.shell
      ? "shell"
      : share >= 0.7
        ? "ingest"
        : share <= 0.3
          ? "emit"
          : "twoway"
    if (tool.shell) {
      for (const [sub, cost] of tool.subs) {
        const program = sub.split(" ")[0]
        put(id, program, sub, cost)
      }
      const listed = sum(tool.subs.values())
      put(id, "(no command parsed)", null, total - listed)
    } else if (tool.subs.size > 1) {
      for (const [sub, cost] of tool.subs) put(id, name, sub, cost)
    } else put(id, name, null, total)
  }
  const groups = GROUPS.map((def) => {
    const items = [...(bucket.get(def.id) || new Map())]
      .map(([name, value]) => ({
        name,
        cost: value.cost,
        children:
          value.children.size > 1
            ? [...value.children]
                .map(([child, cost]) => ({ name: child, cost }))
                .sort((a, b) => b.cost - a.cost)
            : null,
      }))
      .sort((a, b) => b.cost - a.cost)
    return {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      cost: sum(items.map((item) => item.cost)),
      items,
    }
  }).filter((group) => group.cost > 0)
  groups.sort((a, b) => b.cost - a.cost)
  const total = round(scan.input + scan.output)
  const residue = round(total - round(sum(groups.map((group) => group.cost))))
  if (residue && groups[0]?.items[0]) {
    groups[0].cost += residue
    groups[0].items[0].cost += residue
  }
  const groupCost = (id: GroupId): number => groups.find((group) => group.id === id)?.cost || 0
  const output = groups.find((group) => group.id === "output")?.items || []
  const outputCost = (name: string): number => output.find((item) => item.name === name)?.cost || 0
  return {
    total,
    input: round(scan.input),
    output: round(scan.output),
    requests: scan.requests,
    sessions: scan.sessions,
    days:
      scan.spanFrom !== null && scan.spanTo !== null
        ? Math.max(1, Math.round((scan.spanTo - scan.spanFrom) / 86400000))
        : null,
    groups,
    insights: {
      fixedOverhead: groupCost("preamble"),
      reasoning: outputCost("thinking"),
      generatedProse: outputCost("assistant prose (generated)"),
      carriedProse: outputCost("prose-carried"),
      toolInput: groupCost("ingest") + groupCost("shell"),
      toolOutput: groupCost("emit"),
      typedMessages: groupCost("typed"),
    },
  }
}

export function openWalk(): Walk {
  return { scan: emptyScan() }
}

/** Parse and merge one session immediately; callers never need to retain its raw text. */
export function walkOne(walk: Walk, file: RawFile): boolean {
  const before = walk.scan.filesUsed
  scanFile(walk.scan, file)
  return walk.scan.filesUsed > before
}

/** The running total is already merged during `walkOne`, so reporting progress is constant-time. */
export function billedSoFar(walk: Walk): number {
  return walk.scan.input + walk.scan.output
}

export function report(scanned: Scan): Analysis {
  const dataset = makeDataset(scanned)
  const warnings = [
    "Totals come from the provider-reported costs saved by Pi. Line-item splits estimate the context each request sent.",
    "Branch paths are included because Pi billed every branch that appears in a session file.",
  ]
  if (scanned.badLines) warnings.push(`${scanned.badLines} unparseable line(s) skipped.`)
  return { dataset, filesUsed: scanned.filesUsed, warnings }
}

export function analyze(files: RawFile[]): Analysis {
  const walk = openWalk()
  for (const file of files) walkOne(walk, file)
  if (!walk.scan.filesUsed) throw new Error("no readable Pi session files")
  return report(walk.scan)
}
