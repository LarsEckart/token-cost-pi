import { describe, expect, it } from "vitest"
import { hashFor, readHash } from "../src/store.ts"

describe("Pi report state", () => {
  it("round-trips shareable controls", () => {
    const state = {
      path: [],
      open: {},
      query: "bash",
      chart: "sun" as const,
      view: "table" as const,
      pctOnly: true,
      theme: "dark" as const,
    }
    expect(readHash(hashFor(state))).toMatchObject({
      query: "bash",
      chart: "sun",
      view: "table",
      pctOnly: true,
      theme: "dark",
    })
  })
})
