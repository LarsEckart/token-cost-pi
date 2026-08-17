# Working in this repo

This project is public. Do not commit a username, home directory, local path, or real session
content. Use `~/.pi/agent/sessions` and invented examples in docs and tests.

Run `pnpm check` before a commit. The app lives in `src/`; tests live in `test/`. Keep the build
self-contained: no CDN, remote font, image, stylesheet, script, or data request.

Comments should be one sentence and explain a constraint or a trap.
