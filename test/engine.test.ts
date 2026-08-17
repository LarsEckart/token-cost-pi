import assert from "node:assert/strict"
import { analyze, billedSoFar, openWalk, walkOne } from "../src/engine.ts"
import { fixtureRawFiles } from "./fixtures/pi-transcripts.ts"

const files = fixtureRawFiles()
const report = analyze(files)
const data = report.dataset

assert.equal(data.requests, 27)
assert.equal(data.sessions, 9)
assert.equal(data.total, data.input + data.output)
assert.ok(
  Math.abs(data.total - data.groups.reduce((total, group) => total + group.cost, 0)) < 0.001,
)
assert.ok(data.groups.some((group) => group.id === "ingest"))
assert.ok(data.groups.some((group) => group.id === "typed"))
assert.ok(data.groups.some((group) => group.id === "preamble"))
assert.equal(report.dataset.total, data.total)

const walk = openWalk()
for (const file of files) walkOne(walk, file)
assert.ok(billedSoFar(walk) > 0)
assert.equal(walkOne(walk, files[0]), false)
assert.equal(walk.scan.duplicatesDropped, 1)

const tree = [
  {
    type: "session",
    id: "tree",
    version: 3,
    timestamp: "2026-01-01T00:00:00.000Z",
    cwd: "/work/tree",
  },
  {
    type: "message",
    id: "u",
    parentId: null,
    timestamp: "2026-01-01T00:00:01.000Z",
    message: { role: "user", content: "Inspect this." },
  },
  {
    type: "message",
    id: "a",
    parentId: "u",
    timestamp: "2026-01-01T00:00:02.000Z",
    message: {
      role: "assistant",
      provider: "openai",
      model: "gpt",
      content: [
        { type: "toolCall", id: "call", name: "bash", arguments: { command: "git status" } },
      ],
      usage: {
        input: 100,
        output: 10,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { input: 0.01, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.012 },
      },
    },
  },
  {
    type: "message",
    id: "r",
    parentId: "a",
    timestamp: "2026-01-01T00:00:03.000Z",
    message: {
      role: "toolResult",
      toolCallId: "call",
      toolName: "bash",
      content: [{ type: "text", text: "clean" }],
      usage: { cost: { input: 0.003, output: 0.001, cacheRead: 0, cacheWrite: 0, total: 0.004 } },
    },
  },
  {
    type: "compaction",
    id: "c",
    parentId: "r",
    timestamp: "2026-01-01T00:00:04.000Z",
    summary: "The tree is clean.",
    retainedTail: [],
    usage: { cost: { input: 0.004, output: 0.001, cacheRead: 0, cacheWrite: 0, total: 0.005 } },
  },
  {
    type: "message",
    id: "u2",
    parentId: "c",
    timestamp: "2026-01-01T00:00:05.000Z",
    message: { role: "user", content: "Summarize." },
  },
  {
    type: "message",
    id: "a2",
    parentId: "u2",
    timestamp: "2026-01-01T00:00:06.000Z",
    message: {
      role: "assistant",
      provider: "openai",
      model: "gpt",
      content: [{ type: "text", text: "Done." }],
      usage: {
        input: 100,
        output: 10,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { input: 0.01, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.012 },
      },
    },
  },
  {
    type: "message",
    id: "branch",
    parentId: "u",
    timestamp: "2026-01-01T00:00:07.000Z",
    message: {
      role: "assistant",
      provider: "openai",
      model: "gpt",
      content: [{ type: "text", text: "Alternative." }],
      usage: {
        input: 100,
        output: 10,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { input: 0.01, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.012 },
      },
    },
  },
]
const treeReport = analyze([
  { name: "tree.jsonl", text: tree.map((entry) => JSON.stringify(entry)).join("\n") },
])
assert.equal(treeReport.dataset.total, 0.05)
assert.ok(treeReport.dataset.groups.some((group) => group.id === "harness"))
assert.ok(treeReport.dataset.groups.some((group) => group.id === "shell"))

console.log("engine: Pi costs reconcile across branches, compaction, and nested tool usage")
