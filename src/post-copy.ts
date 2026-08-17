/* The English captions that travel with the shared image. */

import type { GroupId } from "./engine.ts"
import type { Draft } from "./model.ts"

/** Captions for the shared image. */
export interface PostCopy {
  /** The span a caption is about: days where the transcripts carry dates, sessions otherwise. */
  scopeDays: (days: number) => string
  scopeSessions: (sessionCount: number, formatted: string) => string
  /** "$12.30 of $98.00", and the covered form that names no total. */
  outOf: (amount: string, total: string) => string
  outOfMasked: (share: string) => string
  /** How a group is said out loud. */
  said: Partial<Record<GroupId, string>>

  toolQuestion: (params: {
    name: string
    amount: string
    outOf: string
    scope: string
    masked: boolean
    second: string | null
    secondAmount: string
  }) => Draft
  commandCosts: (params: {
    name: string
    amount: string
    scope: string
    masked: boolean
    rest: Array<{ name: string; amount: string }>
  }) => Draft
  agentSummary: (params: {
    total: string | null
    scope: string
    requests: string
    typedShare: string | null
  }) => Draft
  typedShare: (params: { outOf: string }) => Draft
  proseCarryRatio: (params: {
    times: string
    generatedAmount: string | null
    carriedAmount: string
  }) => Draft
  billReceipt: (params: {
    total: string | null
    scope: string
    said: string
    share: string
  }) => Draft

  /* The styles below carry two or three phrasings each, drawn from the same flat list as the
     six above: a style that survives its guard on most datasets would otherwise arrive in the
     same words every time it came up. */

  billFigures: (params: {
    total: string | null
    scope: string
    requests: string
    each: string | null
    said: string
    share: string
  }) => Draft[]
  dailyCost: (params: {
    perDay: string
    perRequest: string | null
    days: string
    requests: string
  }) => Draft[]
  typedCostRatio: (params: { times: string; scope: string; requests: string }) => Draft[]
  reasoningCost: (params: {
    amount: string
    share: string | null
    scope: string
    masked: boolean
  }) => Draft[]
  fixedCost: (params: { amount: string; requests: string; scope: string }) => Draft[]
  carriedProseCost: (params: { amount: string; scope: string; masked: boolean }) => Draft[]
  contextThesis: () => Draft[]
  billLines: (params: { scope: string; rows: Array<{ name: string; amount: string }> }) => Draft[]
  outputVsInput: (params: {
    wroteMore: boolean
    higherAmount: string
    lowerAmount: string
  }) => Draft[]
  topProgram: (params: { name: string; amount: string }) => Draft[]
  inputOptimization: (params: {
    name: string
    amount: string
    scope: string
    masked: boolean
  }) => Draft[]
  replyPrompt: () => Draft[]
}

const EN: PostCopy = {
  scopeDays: (days) => `${days} day${days === 1 ? "" : "s"}`,
  scopeSessions: (sessionCount, formatted) =>
    `${formatted} session${sessionCount === 1 ? "" : "s"}`,
  outOf: (amount, total) => `${amount} of ${total}`,
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
  toolQuestion: (params) => {
    const mine = params.masked
      ? `Mine's ${params.name}, at ${params.amount} of the bill.`
      : `Mine's ${params.name}, at ${params.outOf} over ${params.scope}.`
    return {
      lines: [
        "What's the most expensive tool on your Pi bill?",
        params.second ? `${mine} Second was ${params.second}, at ${params.secondAmount}.` : mine,
      ],
      cta: "Find yours",
    }
  },
  commandCosts: (params) => ({
    lines: [
      `Guess what ${params.name} costs you in Pi.`,
      (params.masked
        ? `Mine was ${params.amount} of my bill. `
        : `Mine was ${params.amount} over ${params.scope}. `) +
        params.rest.map((n) => `${n.name} was ${n.amount}.`).join(" "),
      "Every command's output sits in your context and gets re-billed on every turn after it.",
    ],
    cta: "Yours",
  }),
  agentSummary: (params) => ({
    lines: [
      "What's your AI agent actually costing you?",
      `Mine: ${params.total ? `${params.total} over ` : ""}${params.scope} and ${params.requests} requests.` +
        (params.typedShare ? ` I typed ${params.typedShare} of it.` : ""),
    ],
    cta: "Itemise yours",
  }),
  typedShare: (params) => ({
    lines: [
      "Quick — what's the biggest line on your Pi bill?",
      `It isn't what you type. That was ${params.outOf}.`,
      "The rest is rent on context you never see.",
    ],
    cta: "See yours",
  }),
  proseCarryRatio: (params) => ({
    lines: [
      "Which costs more in Pi: what the model writes, or what it re-reads?",
      params.generatedAmount
        ? `Mine: ${params.generatedAmount} to write. ${params.carriedAmount} to re-read the same prose on later turns. ${params.times}.`
        : `Mine: re-reading its own prose cost ${params.times} what writing it did.`,
    ],
    cta: "Check yours",
  }),
  billReceipt: (params) => ({
    lines: [
      params.total
        ? `${params.total} of Pi over ${params.scope}, itemised.`
        : `Itemised ${params.scope} of my Pi bill.`,
      `Biggest line: ${params.said}, ${params.share} of it.`,
      "You don't pay for what the model writes — you pay rent on your context.",
    ],
    cta: "Show me yours",
  }),

  billFigures: (params) => [
    {
      lines: [
        params.total ? `${params.total} — Pi, ${params.scope}.` : `Pi, ${params.scope}.`,
        `${params.requests} requests${params.each ? `, ${params.each} each` : ""}. Biggest line: ${params.said}, ${params.share}.`,
      ],
      cta: "Yours",
    },
    {
      lines: [
        `${params.scope}. ${params.requests} requests.${params.total ? ` ${params.total}.` : ""}`,
        `${params.share} of it went on ${params.said}.`,
      ],
      cta: "Itemise yours",
    },
    {
      lines: [
        `Pi${params.total ? `, ${params.total}` : ""}, ${params.scope}.`,
        `No tips, no thread. Just the receipt: ${params.said}, ${params.share} of the bill.`,
      ],
      cta: "Pull yours",
    },
  ],

  dailyCost: (params) => [
    {
      lines: [
        `My Pi habit runs ${params.perDay} a day.`,
        `${params.days} days, ${params.requests} requests${params.perRequest ? `, ${params.perRequest} a request` : ""}. I thought I was buying answers. I was renting context.`,
      ],
      cta: "Price yours",
    },
    {
      lines: [
        params.perRequest
          ? `Every time I hit enter in Pi it costs ${params.perRequest}.`
          : `Pi is a ${params.perDay}-a-day habit.`,
        `${params.requests} requests over ${params.days} days, ${params.perDay} a day — and most of it isn't the answer.`,
      ],
      cta: "Work out yours",
    },
  ],

  typedCostRatio: (params) => [
    {
      lines: [
        `Typing is the cheapest thing I do in Pi. The context around it costs ${params.times} more.`,
        `${params.scope}, ${params.requests} requests.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        `For every dollar of what I actually typed into Pi, the context around it cost ${params.times} that.`,
        "You aren't paying for your prompt. You're paying rent on everything it drags in behind it.",
      ],
      cta: "Do the maths on yours",
    },
  ],

  reasoningCost: (params) => [
    {
      lines: [
        params.masked
          ? `${params.amount} of my Pi bill was thinking I never read.`
          : `I paid ${params.amount} for thinking I never read.`,
        `Reasoning bills like any other output${params.share ? `, and mine came to ${params.share} of ${params.scope}` : ` — that over ${params.scope}`}.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        "The model thinks before it answers, and you buy the thinking too.",
        `Mine was ${params.amount} over ${params.scope}. Not the answer — the deliberation in front of it.`,
      ],
      cta: "See yours",
    },
  ],

  fixedCost: (params) => [
    {
      lines: [
        "Every Pi request has a price before you type a character.",
        `System prompt and tool schemas, sent again ${params.requests} times: ${params.amount}. I never saw a token of it.`,
      ],
      cta: "Price yours",
    },
    {
      lines: [
        `${params.amount} of my Pi bill was spent before I said anything.`,
        `That's the system prompt and the tool schemas, shipped again on every one of ${params.requests} requests.`,
      ],
      cta: "Find yours",
    },
  ],

  carriedProseCost: (params) => [
    {
      lines: [
        params.masked
          ? `${params.amount} of my Pi bill was the model re-reading its own thoughts.`
          : `Today I learned I paid ${params.amount} to have a model re-read its own thoughts.`,
      ],
      cta: "Your turn",
    },
    {
      lines: [
        `${params.amount} of ${params.scope} of Pi went on the model reading back what it had already written.`,
        "Nobody sends you an invoice for that. The transcript does.",
      ],
      cta: "See yours",
    },
  ],

  contextThesis: () => [
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

  billLines: (params) => [
    {
      lines: [
        `${params.scope} of Pi, itemised.`,
        params.rows.map((r) => `${r.name} — ${r.amount}`).join("\n"),
      ],
      cta: "Itemise yours",
    },
    {
      lines: [
        "My Pi bill, biggest line first:",
        params.rows.map((r) => `${r.amount} — ${r.name}`).join("\n"),
        `That's ${params.scope}.`,
      ],
      cta: "Yours",
    },
  ],

  outputVsInput: (params) => [
    {
      lines: [
        "Which is bigger on your Pi bill: everything the model wrote, or everything your tools read in?",
        params.wroteMore
          ? `I'd have said the second. It was the first, ${params.higherAmount} to ${params.lowerAmount}.`
          : `I'd have said the first. It was the second, ${params.higherAmount} to ${params.lowerAmount}.`,
      ],
      cta: "Settle yours",
    },
    {
      lines: [
        params.wroteMore
          ? `On my Pi bill, what the model wrote (${params.higherAmount}) beat what my tools read in (${params.lowerAmount}).`
          : `On my Pi bill, what my tools read in (${params.higherAmount}) beat what the model wrote (${params.lowerAmount}).`,
        "One of those I asked for. The other just turned up.",
      ],
      cta: "Compare yours",
    },
  ],

  topProgram: (params) => [
    {
      lines: [
        `The most expensive program on my Pi bill is ${params.name}.`,
        "Not the model. The program.",
      ],
      cta: "Find yours",
    },
    {
      lines: [
        `${params.name} cost me ${params.amount} of Pi.`,
        "It doesn't think and it doesn't answer. It just puts things in the context that get billed again every turn after.",
      ],
      cta: "See yours",
    },
  ],

  inputOptimization: (params) => [
    {
      lines: [
        "The cheapest optimisation in Pi isn't a better prompt.",
        `It's keeping a huge tool output out of the context at all — you pay for it again on every turn after. ${params.name} alone: ${params.amount}${params.masked ? "" : ` over ${params.scope}`}.`,
      ],
      cta: "Check yours",
    },
    {
      lines: [
        params.masked
          ? `${params.name} was ${params.amount} of my Pi bill.`
          : `${params.name} was ${params.amount} of my Pi bill over ${params.scope}.`,
        "Not because I called it a lot. Because what it returned sat in the context and got re-billed every turn after.",
      ],
      cta: "Check yours",
    },
  ],

  replyPrompt: () => [
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
