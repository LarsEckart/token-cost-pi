# Design brief — Pi cost-attribution report

Build one static HTML page that answers: **I spent this much with Pi — what put those tokens in
context?**

The reader drops Pi session JSONL files from `~/.pi/agent/sessions/`. Parse every file in the
browser. Never upload a transcript or make a network request with its contents.

## Truths the interface must keep

- The total comes from Pi's stored `usage.cost`, not a guessed model price.
- The row split estimates context size. State that clearly.
- Pi stores sessions as trees. Include all billed branches, and honour compaction checkpoints when
  rebuilding a request's context.
- Show tooling as calls and results. Shell tools drill into command and subcommand.
- Keep a table view, keyboard controls, visible focus, amount masking, dark/light/system themes,
  and a responsive layout.
- Build a single classic-script HTML file that also works from `file://`.

The visual language should feel like a precise ledger or meter. It should make the key mechanism
clear: a tool result can cost more later as it remains in context than when it first appears.
