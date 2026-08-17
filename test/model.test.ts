import assert from "node:assert/strict"
import { analyze } from "../src/engine.ts"
import { fixtureRawFiles } from "./fixtures/pi-transcripts.ts"
import {
  focusForPath,
  foldSmallNodes,
  ledger,
  pathFromSlugs,
  slug,
  sunburst,
} from "../src/model.ts"

const data = analyze(fixtureRawFiles()).dataset
const group = data.groups[0]
assert.deepEqual(pathFromSlugs(data, [slug(group.name)]), [group.name])
assert.equal(focusForPath(data, [group.name]).node.name, group.name)
assert.equal(
  foldSmallNodes(group.items, group.cost).reduce((total, item) => total + item.cost, 0),
  group.cost,
)
assert.ok(sunburst(focusForPath(data, [])).length > 0)
assert.equal(ledger(data, [], {}, "").recon, data.total)

console.log("model: report views preserve Pi cost totals")
