import { describe, expect, it } from "vitest"
import { analyze } from "../src/engine.ts"
import { fixtureRawFiles } from "./fixtures/pi-transcripts.ts"
import { pathOf, slug } from "../src/model.ts"

describe("Pi report URLs", () => {
  it("resolves a group path from its stable slug", () => {
    const data = analyze(fixtureRawFiles()).dataset
    const group = data.groups[0]
    expect(pathOf(data, [slug(group.name)])).toEqual([group.name])
  })
})
