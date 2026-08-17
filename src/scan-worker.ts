// oxlint-disable unicorn(require-post-message-target-origin) -- Worker messages never navigate or cross origins.
/* Parse private session files away from the page's rendering thread. */

import { billedSoFar, openWalk, report, walkOne } from "./engine.ts"

interface ScanRequest {
  type: "scan"
  files: File[]
}

type Reply =
  | { type: "progress"; done: number; total: number; name: string; cost: number }
  | { type: "complete"; data: ReturnType<typeof report> }
  | { type: "error"; message: string }

self.onmessage = async (event: MessageEvent<ScanRequest>): Promise<void> => {
  if (event.data.type !== "scan") return
  const walk = openWalk()
  try {
    /* oxlint-disable no-await-in-loop -- One file at a time bounds memory to one session. */
    for (const [index, file] of event.data.files.entries()) {
      walkOne(walk, { name: file.name, text: await file.text() })
      const reply: Reply = {
        type: "progress",
        done: index + 1,
        total: event.data.files.length,
        name: file.name,
        cost: billedSoFar(walk),
      }
      self.postMessage(reply)
    }
    /* oxlint-enable no-await-in-loop */
    self.postMessage({ type: "complete", data: report(walk.scan) } satisfies Reply)
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    } satisfies Reply)
  }
}
// oxlint-enable unicorn(require-post-message-target-origin)
