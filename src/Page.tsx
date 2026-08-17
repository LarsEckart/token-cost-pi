/* The page, which is one card that changes what it holds. */

import { Fragment, useEffect, useRef } from "react"
import type { Analysis } from "./engine.ts"
import { ReportContext, useReportCtx } from "./context.ts"
import { useT, type Word } from "./copy.tsx"
import { money } from "./model.ts"
import {
  applyUrl,
  hashFor,
  hoverClear,
  pathFor,
  readPath,
  useNarrow,
  useViewState,
  type ViewState,
} from "./store.ts"
import { Figure, Reveal, TextSwap, useCountingUp } from "./Motion.tsx"
import { Toolbar } from "./Toolbar.tsx"
import { Breakdown, CardBody, Footnotes, scopeOf, Strip } from "./Report.tsx"
import { Intake, Where } from "./Upload.tsx"

/** Which way the page is moving. */
export type Dir = "fwd" | "back"

/** The address, kept level with what the page is showing. The path is a place and earns an entry
 *  of its own -- opening the report, and drilling into a group -- while the settings in the hash
 *  rewrite the entry they are held on, so Back is not a walk through every chart the reader
 *  tried. */
function useUrlSync(
  state: ViewState,
  data: Analysis | null,
  report: boolean,
  leaving: boolean,
): void {
  const where = pathFor(report, state.path)
  const url = where + location.search + hashFor(state)
  const prev = useRef(where)

  useEffect(() => {
    /* A face held mounted for its exit is showing a view the address has already left; writing
       from it would put the departing report back over the entry the reader just returned to. */
    if (leaving) return
    const moved = prev.current !== where
    prev.current = where
    try {
      /* Nothing to write when the browser is already there, which is how a Back or a Forward
         arrives: the address moved first and the page followed it. Pushing here would bury the
         entry the reader just came out of. */
      if (location.pathname + location.search + location.hash === url) return
      if (moved) history.pushState(null, "", url)
      else history.replaceState(null, "", url)
    } catch {
      /* file:// can refuse */
    }
  }, [url, where, leaving])

  /* An address typed or edited by hand, which `popstate` does not cover. A turn is in flight when
     the two disagree, and that is the App's to finish -- applying the new view under the face on
     its way out would reshape the picture as it leaves. */
  useEffect(() => {
    const onHash = (): void => {
      if (readPath(location.pathname).report === report) applyUrl(data)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [report, data])
}

/** Where the footer points, in the order it reads them. The addresses are the only strings on the
 *  page that are not the dictionary's to translate. */
const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "https://github.com/earendil-works/pi-mono", label: "Pi" },
  {
    href: "https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/session-format.md",
    label: "Session format",
  },
]

/** `noreferrer` for what the page promises rather than out of habit: the address carries the view
 *  in its hash, and the referrer would hand that to the other end. */
function Out({
  href,
  code,
  children,
}: {
  href: string
  code?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <a href={href} target="_blank" rel="noreferrer" data-code={code ? 1 : undefined}>
      {children}
    </a>
  )
}

/** Who made it. Outside both faces and outside the card, because it belongs to the page rather
 *  than to whatever the card is currently showing. */
function Colophon(): React.JSX.Element {
  return (
    <footer className="colophon">
      <span>Built for local Pi sessions.</span>
      <nav>
        {LINKS.map((link) => (
          <Out key={link.href} href={link.href}>
            {link.label}
          </Out>
        ))}
      </nav>
    </footer>
  )
}

/** One face of the heading, set word by word so the words can be told apart. */
function Heading({ words, gap }: { words: Word[]; gap: string }): React.JSX.Element {
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={word.w}>
          {i && !word.tight ? gap : null}
          {word.em ? (
            <em data-w={word.w}>{word.text}</em>
          ) : (
            <span data-w={word.w}>{word.text}</span>
          )}
        </Fragment>
      ))}
    </>
  )
}

export function Page({
  data,
  leaving,
  dir,
  onData,
  onReset,
}: {
  /** The analysis the card is showing, or `null` for the empty face. */
  data: Analysis | null
  /** The face on show is on its way out: it is held mounted, playing its exit. */
  leaving: boolean
  dir: Dir
  onData: (data: Analysis) => void
  onReset: () => void
}): React.JSX.Element {
  const state = useViewState()
  const t = useT()
  const ctx = useReportCtx(data, state)
  const narrow = useNarrow()

  /* One string, so the two faces cannot mount different panels by disagreeing about which one is
     on show. */
  const face = ctx ? "report" : "empty"
  useUrlSync(state, data, !!ctx, leaving)

  const billed = ctx ? t.card.billed(state.pctOnly) : t.card.nothingYet
  /* What the empty card's figure counts from, and what it counts through: the walk writes its
     running total into this box as it reads, so the slot holds $0.00 before a folder is picked
     and then climbs towards the bill from the first transcript to the last. */
  const sofar = useRef(0)
  const counted = useCountingUp(sofar, !ctx)

  /* The figure twice over: as a number for the rolling digits, and as text for the one state
     that is not one. */
  const total = ctx ? (state.pctOnly ? null : ctx.d.total) : counted
  const figureText = money(ctx ? ctx.d.total : counted)
  const totalText = ctx && state.pctOnly ? "****" : figureText

  return (
    <ReportContext.Provider value={ctx}>
      {/* The one place a highlight is dropped: every view marks the elements that stand
          for something, and this reads the pointer and the focus against those marks. See
          `hoverClear`. */}
      <div className="shell" data-dir={dir} {...hoverClear}>
        <Toolbar report={!!ctx} leaving={leaving} onReset={onReset} />
        {/* The frame, and the only element on the page that is never replaced. `data-chart`
            gives the empty card the shape the report will have, so a file drop changes what is
            inside the box without changing the box; `data-face` is what makes its border a
            dashed invitation until then. */}
        <section className="card t-resize" data-chart={state.chart} data-face={face}>
          <span className="br br1" />
          <span className="br br2" />
          <span className="br br3" />
          <span className="br br4" />
          <header className="chead">
            <div>
              {/* The words are identical on both faces; the report adds its scope at the end
                  rather than replacing the line. The whole line is dropped on a narrow window:
                  see `.chead` in the stylesheet. */}
              <div className="eyebrow">
                {t.card.eyebrow}
                <TextSwap token={face}>{ctx ? " · " + scopeOf(t, ctx.d) : ""}</TextSwap>
              </div>
              {/* One sentence in two tenses, set word by word so the words can be told apart.
                  In English "Where", "your" and "money" are the same three words on both faces,
                  and the question loses two the answer does not have -- so the shared three
                  travel to where the shorter sentence puts them while "did" and "go?" leave and
                  "went" arrives. `data-w` is what the stylesheet names them by; `money` keeps
                  its accent across the change, which is what makes it the one to follow.
                  Which slots a language shares is the dictionary's to say: `zh` shares two and
                  uses no "where" at all, `de` shares three. */}
              <h1>
                <TextSwap token={face}>
                  <Heading words={ctx ? t.card.answer : t.card.ask} gap={t.card.gap} />
                </TextSwap>
              </h1>
            </div>
            <div className="cfig">
              {/* What qualifies the figure, gathered so a narrow window can stand beside it in
                  the corner the caption alone holds on a wide one. `display: contents` above
                  that width, so the caption stays exactly where the header's grid puts it. */}
              <div className="qual">
                {/* Not swapped, unlike the two lines beside it: this is the caption on a figure
                    that already re-enters character by character whenever it changes, and two
                    animations saying the same thing on adjacent lines is one too many. */}
                <div className="billed">{billed}</div>
              </div>
              {/* The figure's place is held by a dash before there is a figure, so the bill
                  arrives in the slot that was waiting for it rather than pushing the header
                  around on its way in. */}
              <div
                className="total"
                style={
                  /* SAFETY: React's CSSProperties omits custom CSS variables used by the stylesheet. */
                  { "--fig": figureText.length } as React.CSSProperties
                }
                data-hidden={state.pctOnly && ctx ? 1 : 0}
                data-empty={ctx ? 0 : 1}
              >
                <Figure
                  value={total}
                  text={totalText}
                  className={state.pctOnly && ctx ? "mask" : undefined}
                />
              </div>
            </div>
          </header>
          {/* Keyed on the face, so the arriving one has a closed state to travel from, and
              `closed` held from outside for the length of the exit, so the departing one has
              somewhere to go. */}
          <Reveal key={face} className="cardslot" closed={leaving}>
            {ctx ? <CardBody /> : <Intake onData={onData} sofar={sofar} />}
          </Reveal>
        </section>
        {/* What stands under the card: the breakdown and the footnotes, or the help for
            finding the transcripts in the first place. */}
        <Reveal key={face} className="below" closed={leaving}>
          {ctx ? (
            <>
              <Breakdown />
              {/* Where the card's three figures go on a narrow window: they are what the thesis
                  argues *from*, and reading them costs a line each, so they wait until the
                  reader has been through the picture and the line items rather than standing
                  between the bill and the chart. */}
              {narrow ? <Strip only="figures" /> : null}
              <Footnotes />
            </>
          ) : (
            <Where />
          )}
        </Reveal>
        <Colophon />
      </div>
    </ReportContext.Provider>
  )
}
