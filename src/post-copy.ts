/* The English captions that travel with the shared image. */

import type { GroupId } from "./engine.ts"
import type { Draft } from "./model.ts"

/** Captions for the shared image. */
export interface PostCopy {
  /** The span a caption is about: days where the transcripts carry dates, sessions otherwise. */
  scopeDays: (n: number) => string
  scopeSessions: (n: number, formatted: string) => string
  /** "$12.30 of $98.00", and the covered form that names no total. */
  outOf: (amt: string, total: string) => string
  outOfMasked: (share: string) => string
  /** How a group is said out loud. */
  said: Partial<Record<GroupId, string>>

  a: (p: {
    name: string
    amt: string
    outOf: string
    scope: string
    masked: boolean
    second: string | null
    secondAmt: string
  }) => Draft
  b: (p: {
    name: string
    amt: string
    scope: string
    masked: boolean
    rest: Array<{ name: string; amt: string }>
  }) => Draft
  c: (p: {
    total: string | null
    scope: string
    requests: string
    typedShare: string | null
  }) => Draft
  d: (p: { outOf: string }) => Draft
  e: (p: { times: string; gen: string | null; carry: string }) => Draft
  f: (p: { total: string | null; scope: string; said: string; share: string }) => Draft

  /* The styles below carry two or three phrasings each, drawn from the same flat list as the
     six above: a style that survives its guard on most datasets would otherwise arrive in the
     same words every time it came up. */

  g: (p: {
    total: string | null
    scope: string
    requests: string
    each: string | null
    said: string
    share: string
  }) => Draft[]
  h: (p: { perDay: string; perRequest: string | null; days: string; requests: string }) => Draft[]
  i: (p: { times: string; scope: string; requests: string }) => Draft[]
  j: (p: { amt: string; share: string | null; scope: string; masked: boolean }) => Draft[]
  k: (p: { amt: string; requests: string; scope: string }) => Draft[]
  l: (p: { amt: string; scope: string; masked: boolean }) => Draft[]
  m: () => Draft[]
  n: (p: { scope: string; rows: Array<{ name: string; amt: string }> }) => Draft[]
  o: (p: { wroteMore: boolean; hi: string; lo: string }) => Draft[]
  p: (p: { name: string; amt: string }) => Draft[]
  q: (p: { name: string; amt: string; scope: string; masked: boolean }) => Draft[]
  r: () => Draft[]
}

const EN: PostCopy = {
  scopeDays: (n) => `${n} day${n === 1 ? "" : "s"}`,
  scopeSessions: (n, f) => `${f} session${n === 1 ? "" : "s"}`,
  outOf: (amt, total) => `${amt} of ${total}`,
  outOfMasked: (share) => `${share} of it`,
  said: {
    shell: "shell commands",
    ingest: "what tools read into the context",
    emit: "what tools wrote back out",
    twoway: "tool traffic, both directions",
    output: "the model's own output",
    preamble: "the system prompt and tool schemas",
    harness: "harness scaffolding and reminders",
    media: "images and attachments",
    typed: "the part I actually typed",
  },
  a: (p) => {
    const mine = p.masked
      ? `Mine's ${p.name}, at ${p.amt} of the bill.`
      : `Mine's ${p.name}, at ${p.outOf} over ${p.scope}.`
    return {
      lines: [
        "What's the most expensive tool on your Pi bill?",
        p.second ? `${mine} Second was ${p.second}, at ${p.secondAmt}.` : mine,
      ],
      cta: "Find yours",
    }
  },
  b: (p) => ({
    lines: [
      `Guess what ${p.name} costs you in Pi.`,
      (p.masked ? `Mine was ${p.amt} of my bill. ` : `Mine was ${p.amt} over ${p.scope}. `) +
        p.rest.map((n) => `${n.name} was ${n.amt}.`).join(" "),
      "Every command's output sits in your context and gets re-billed on every turn after it.",
    ],
    cta: "Yours",
  }),
  c: (p) => ({
    lines: [
      "What's your AI agent actually costing you?",
      `Mine: ${p.total ? `${p.total} over ` : ""}${p.scope} and ${p.requests} requests.` +
        (p.typedShare ? ` I typed ${p.typedShare} of it.` : ""),
    ],
    cta: "Itemise yours",
  }),
  d: (p) => ({
    lines: [
      "Quick — what's the biggest line on your Pi bill?",
      `It isn't what you type. That was ${p.outOf}.`,
      "The rest is rent on context you never see.",
    ],
    cta: "See yours",
  }),
  e: (p) => ({
    lines: [
      "Which costs more in Pi: what the model writes, or what it re-reads?",
      p.gen
        ? `Mine: ${p.gen} to write. ${p.carry} to re-read the same prose on later turns. ${p.times}.`
        : `Mine: re-reading its own prose cost ${p.times} what writing it did.`,
    ],
    cta: "Check yours",
  }),
  f: (p) => ({
    lines: [
      p.total
        ? `${p.total} of Pi over ${p.scope}, itemised.`
        : `Itemised ${p.scope} of my Pi bill.`,
      `Biggest line: ${p.said}, ${p.share} of it.`,
      "You don't pay for what the model writes — you pay rent on your context.",
    ],
    cta: "Show me yours",
  }),

  g: (p) => [
    {
      lines: [
        p.total ? `${p.total} — Pi, ${p.scope}.` : `Pi, ${p.scope}.`,
        `${p.requests} requests${p.each ? `, ${p.each} each` : ""}. Biggest line: ${p.said}, ${p.share}.`,
      ],
      cta: "Yours",
    },
    {
      lines: [
        `${p.scope}. ${p.requests} requests.${p.total ? ` ${p.total}.` : ""}`,
        `${p.share} of it went on ${p.said}.`,
      ],
      cta: "Itemise yours",
    },
    {
      lines: [
        `Pi${p.total ? `, ${p.total}` : ""}, ${p.scope}.`,
        `No tips, no thread. Just the receipt: ${p.said}, ${p.share} of the bill.`,
      ],
      cta: "Pull yours",
    },
  ],

  h: (p) => [
    {
      lines: [
        `My Pi habit runs ${p.perDay} a day.`,
        `${p.days} days, ${p.requests} requests${p.perRequest ? `, ${p.perRequest} a request` : ""}. I thought I was buying answers. I was renting context.`,
      ],
      cta: "Price yours",
    },
    {
      lines: [
        p.perRequest
          ? `Every time I hit enter in Pi it costs ${p.perRequest}.`
          : `Pi is a ${p.perDay}-a-day habit.`,
        `${p.requests} requests over ${p.days} days, ${p.perDay} a day — and most of it isn't the answer.`,
      ],
      cta: "Work out yours",
    },
  ],

  i: (p) => [
    {
      lines: [
        `Typing is the cheapest thing I do in Pi. The context around it costs ${p.times} more.`,
        `${p.scope}, ${p.requests} requests.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        `For every dollar of what I actually typed into Pi, the context around it cost ${p.times} that.`,
        "You aren't paying for your prompt. You're paying rent on everything it drags in behind it.",
      ],
      cta: "Do the maths on yours",
    },
  ],

  j: (p) => [
    {
      lines: [
        p.masked
          ? `${p.amt} of my Pi bill was thinking I never read.`
          : `I paid ${p.amt} for thinking I never read.`,
        `Reasoning bills like any other output${p.share ? `, and mine came to ${p.share} of ${p.scope}` : ` — that over ${p.scope}`}.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        "The model thinks before it answers, and you buy the thinking too.",
        `Mine was ${p.amt} over ${p.scope}. Not the answer — the deliberation in front of it.`,
      ],
      cta: "See yours",
    },
  ],

  k: (p) => [
    {
      lines: [
        "Every Pi request has a price before you type a character.",
        `System prompt and tool schemas, sent again ${p.requests} times: ${p.amt}. I never saw a token of it.`,
      ],
      cta: "Price yours",
    },
    {
      lines: [
        `${p.amt} of my Pi bill was spent before I said anything.`,
        `That's the system prompt and the tool schemas, shipped again on every one of ${p.requests} requests.`,
      ],
      cta: "Find yours",
    },
  ],

  l: (p) => [
    {
      lines: [
        p.masked
          ? `${p.amt} of my Pi bill was the model re-reading its own thoughts.`
          : `Today I learned I paid ${p.amt} to have a model re-read its own thoughts.`,
      ],
      cta: "Your turn",
    },
    {
      lines: [
        `${p.amt} of ${p.scope} of Pi went on the model reading back what it had already written.`,
        "Nobody sends you an invoice for that. The transcript does.",
      ],
      cta: "See yours",
    },
  ],

  m: () => [
    {
      lines: [
        "The most expensive line on my Pi bill isn't the model's answers.",
        "It isn't what I typed either. It's the same text, re-read on every turn after it.",
      ],
      cta: "Find yours",
    },
    {
      lines: ["I itemised my Pi bill and the biggest line was something I never looked at once."],
      cta: "See yours",
    },
    {
      lines: [
        "Everyone's off optimising their prompts.",
        "The bill isn't in the prompt. It's in everything the prompt drags into the context behind it, charged again every turn.",
      ],
      cta: "Look at yours",
    },
  ],

  n: (p) => [
    {
      lines: [`${p.scope} of Pi, itemised.`, p.rows.map((r) => `${r.name} — ${r.amt}`).join("\n")],
      cta: "Itemise yours",
    },
    {
      lines: [
        "My Pi bill, biggest line first:",
        p.rows.map((r) => `${r.amt} — ${r.name}`).join("\n"),
        `That's ${p.scope}.`,
      ],
      cta: "Yours",
    },
  ],

  o: (p) => [
    {
      lines: [
        "Which is bigger on your Pi bill: everything the model wrote, or everything your tools read in?",
        p.wroteMore
          ? `I'd have said the second. It was the first, ${p.hi} to ${p.lo}.`
          : `I'd have said the first. It was the second, ${p.hi} to ${p.lo}.`,
      ],
      cta: "Settle yours",
    },
    {
      lines: [
        p.wroteMore
          ? `On my Pi bill, what the model wrote (${p.hi}) beat what my tools read in (${p.lo}).`
          : `On my Pi bill, what my tools read in (${p.hi}) beat what the model wrote (${p.lo}).`,
        "One of those I asked for. The other just turned up.",
      ],
      cta: "Compare yours",
    },
  ],

  p: (p) => [
    {
      lines: [
        `The most expensive program on my Pi bill is ${p.name}.`,
        "Not the model. The program.",
      ],
      cta: "Find yours",
    },
    {
      lines: [
        `${p.name} cost me ${p.amt} of Pi.`,
        "It doesn't think and it doesn't answer. It just puts things in the context that get billed again every turn after.",
      ],
      cta: "See yours",
    },
  ],

  q: (p) => [
    {
      lines: [
        "The cheapest optimisation in Pi isn't a better prompt.",
        `It's keeping a huge tool output out of the context at all — you pay for it again on every turn after. ${p.name} alone: ${p.amt}${p.masked ? "" : ` over ${p.scope}`}.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        p.masked
          ? `${p.name} was ${p.amt} of my Pi bill.`
          : `${p.name} was ${p.amt} of my Pi bill over ${p.scope}.`,
        "Not because I called it a lot. Because what it returned sat in the context and got re-billed every turn after.",
      ],
      cta: "Check yours",
    },
  ],

  r: () => [
    {
      lines: ["Guess the biggest line on my Pi bill. One try.", "It isn't the model writing code."],
      cta: "Then go and find yours",
    },
    {
      lines: [
        "Bet you can't say what you're actually paying for in Pi.",
        "It isn't the answers. It's what sits in the context while you get them.",
      ],
      cta: "Prove me wrong",
    },
    {
      lines: [
        "Reply with the biggest line on your Pi bill. I'll go first: it wasn't anything I typed.",
      ],
      cta: "Get yours",
    },
  ],
}

/** The English captions that travel with the shared image. */
export function postCopy(): PostCopy {
  return EN
}
