/* Invented Pi-shaped transcripts keep report tests independent from local sessions. */

import type { RawFile } from "../../src/engine.ts"

interface FixtureFile {
  name: string
  build(): string
}

const cost = (input: number, output: number) => ({
  input: input / 1e6,
  output: output / 1e6,
  cacheRead: 0,
  cacheWrite: 0,
  total: (input + output) / 1e6,
})

function file(index: number): FixtureFile {
  const id = `fixture-${index}`
  const entries = [
    {
      type: "session",
      version: 3,
      id,
      timestamp: "2026-01-01T10:00:00.000Z",
      cwd: "/work/fixture",
    },
    {
      type: "message",
      id: `${id}-u`,
      parentId: null,
      timestamp: "2026-01-01T10:00:01.000Z",
      message: {
        role: "user",
        content: "Find the parser bug, fix it, and run the tests. ".repeat(100),
      },
    },
    {
      type: "message",
      id: `${id}-a1`,
      parentId: `${id}-u`,
      timestamp: "2026-01-01T10:00:02.000Z",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt-5",
        stopReason: "toolUse",
        usage: {
          input: 12000,
          output: 900,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 12900,
          cost: cost(12000, 900),
        },
        content: [
          { type: "thinking", thinking: "I need to inspect the parser and its tests first." },
          {
            type: "toolCall",
            id: `${id}-read`,
            name: "read",
            arguments: { path: "src/parser.ts" },
          },
          {
            type: "toolCall",
            id: `${id}-bash`,
            name: "bash",
            arguments: { command: "rg parser test src test" },
          },
        ],
      },
    },
    {
      type: "message",
      id: `${id}-r1`,
      parentId: `${id}-a1`,
      timestamp: "2026-01-01T10:00:03.000Z",
      message: {
        role: "toolResult",
        toolCallId: `${id}-read`,
        toolName: "read",
        content: [
          {
            type: "text",
            text: "export function parse(input: string) {\n  return input.trim().split(',')\n}\n".repeat(
              30,
            ),
          },
        ],
      },
    },
    {
      type: "message",
      id: `${id}-r2`,
      parentId: `${id}-r1`,
      timestamp: "2026-01-01T10:00:04.000Z",
      message: {
        role: "toolResult",
        toolCallId: `${id}-bash`,
        toolName: "bash",
        content: [{ type: "text", text: "src/parser.ts\ntest/parser.test.ts\n".repeat(20) }],
      },
    },
    {
      type: "message",
      id: `${id}-a2`,
      parentId: `${id}-r2`,
      timestamp: "2026-01-01T10:00:05.000Z",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt-5",
        stopReason: "toolUse",
        usage: {
          input: 19000,
          output: 1200,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 20200,
          cost: cost(19000, 1200),
        },
        content: [
          {
            type: "text",
            text: "The trailing empty field is lost. I will add a focused test and change the split.",
          },
          {
            type: "toolCall",
            id: `${id}-edit`,
            name: "edit",
            arguments: { path: "src/parser.ts", oldText: "input.trim()", newText: "input" },
          },
          { type: "toolCall", id: `${id}-test`, name: "bash", arguments: { command: "pnpm test" } },
        ],
      },
    },
    {
      type: "message",
      id: `${id}-r3`,
      parentId: `${id}-a2`,
      timestamp: "2026-01-01T10:00:06.000Z",
      message: {
        role: "toolResult",
        toolCallId: `${id}-edit`,
        toolName: "edit",
        content: [{ type: "text", text: "Done." }],
      },
    },
    {
      type: "message",
      id: `${id}-r4`,
      parentId: `${id}-r3`,
      timestamp: "2026-01-01T10:00:07.000Z",
      message: {
        role: "toolResult",
        toolCallId: `${id}-test`,
        toolName: "bash",
        content: [{ type: "text", text: "12 tests passed\n" }],
      },
    },
    {
      type: "message",
      id: `${id}-a3`,
      parentId: `${id}-r4`,
      timestamp: "2026-01-01T10:00:08.000Z",
      message: {
        role: "assistant",
        provider: "openai",
        model: "gpt-5",
        stopReason: "stop",
        usage: {
          input: 22000,
          output: 500,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 22500,
          cost: cost(22000, 500),
        },
        content: [
          { type: "text", text: "Fixed the parser and added coverage. The test suite passes." },
        ],
      },
    },
  ]
  return {
    name: `pi-fixture-${index}.jsonl`,
    build: () => entries.map((entry) => JSON.stringify(entry)).join("\n"),
  }
}

export function fixtureFiles(): FixtureFile[] {
  return Array.from({ length: 9 }, (_, index) => file(index + 1))
}

export const fixtureRawFiles = (): RawFile[] =>
  fixtureFiles().map((fixture) => ({ name: fixture.name, text: fixture.build() }))
