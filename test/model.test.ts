import assert from "node:assert/strict"
import { analyze } from "../src/engine.ts"
import { fixtureRawFiles } from "./fixtures/pi-transcripts.ts"
import { focusOf, fold, ledger, pathOf, slug, sunburst } from "../src/model.ts"

const data = analyze(fixtureRawFiles()).dataset
const group = data.groups[0]
assert.deepEqual(pathOf(data, [slug(group.name)]), [group.name])
assert.equal(focusOf(data, [group.name]).node.name, group.name)
assert.equal(
  fold(group.items, group.cost).reduce((total, item) => total + item.cost, 0),
  group.cost,
)
assert.ok(sunburst(focusOf(data, [])).length > 0)
assert.equal(ledger(data, [], {}, "").recon, data.total)

console.log("model: report views preserve Pi cost totals")
