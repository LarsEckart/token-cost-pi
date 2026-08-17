# Pi cost attribution

Inspired by [HerringtonDarkholme/token-cost](https://github.com/HerringtonDarkholme/token-cost), rewritten for Pi.

Drop Pi session `.jsonl` files into this local page to see every provider-reported dollar split
across the context that led to it: typed prompts, tool calls and results, assistant output,
compaction, and Pi's fixed context.

## Use it

```sh
pnpm install
pnpm build
open cost-report.html
```

The output is one self-contained HTML file. It works from `file://`; it uploads nothing and makes
no requests with session data.

Pi saves persistent sessions under `~/.pi/agent/sessions/`, one directory per working directory.
Choose that folder, a project directory inside it, or drop individual `.jsonl` files.

## What it measures

Pi stores exact provider-reported costs on assistant messages (`usage.cost`). Those values make the
report total. The split across rows is an estimate: the report rebuilds each assistant request's
parent path, estimates the size of the content in that context, then shares input and cache cost
between those parts. Output cost goes to thinking, prose, and tool-call arguments from the response
that created it.

Pi sessions are trees. The report includes every branch in a file, because Pi billed every request
recorded there. A compaction replaces earlier context with its saved summary and retained tail.

The report also assigns nested LLM usage saved on tool results to that tool. It does not invent a
rate card: sessions without `usage.cost` have no billable total to show.

## Large session stores

Scanning runs in a browser worker, so the page stays usable while it reads. Each session is parsed
and merged once, then its raw text is released; the report keeps only its combined cost rows. The
running total is updated from that merge rather than by re-reading earlier files. This keeps memory
near the largest single session plus the compact report data, not the full selected store.

## Develop

```sh
pnpm dev
pnpm format
pnpm typecheck
pnpm test
pnpm check
```

`pnpm build` emits `dist/index.html` and `cost-report.html`. The build fails if either output needs
an external script, stylesheet, image, font, or network request.

## Limits

- Row splits use a four-characters-per-token estimate. The total remains exact to what Pi stored.
- Image blocks use a conservative 1,000-token estimate when their original token count is not
  available.
- `--no-session` runs leave no file for this page to read.
- A session file can change while Pi is still writing it. Re-run the report after the session ends.
