# Contributing to PlainKit

Thanks for taking the time. PlainKit is a static site of small everyday tools, and two rules decide
what belongs here.

## The two rules

1. **Every tool must produce something worth sharing** — a card, an image, a code, or a line of text
   someone would send to someone else. A tool whose result nobody would ever pass on does not belong
   in the collection.
2. **Everything runs in the browser.** No runtime dependency, no tracker, no analytics, no network
   request, no account. Results are deterministic — no tool asks an AI for its answer.

If a change breaks either rule, it will not be merged, however useful it looks.

## Getting set up

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:4321
```

## Before you open a pull request

All five gates must pass; CI runs exactly the same sequence.

```bash
npm run format
npm run typecheck
npm test
npm run build
npm run budget
```

- `format` — Prettier, including Markdown and Astro files.
- `typecheck` — `astro check` plus `tsc --noEmit`.
- `test` — Vitest, unit tests only.
- `build` — static build into `dist/`.
- `budget` — fails when a page grows past its JavaScript/CSS budget, or when an external domain shows
  up in the output.

## Adding a tool

A tool lives in two places, both named with the same slug (the URL segment):

```
src/lib/tools/<slug>/          pure logic + unit tests
src/pages/tools/<slug>/index.astro   the page
```

Then register it in `src/lib/shared/tools.ts` so it appears on the home page.

What reviewers will look for:

- **Logic stays pure.** Everything that can be tested without a browser belongs in `src/lib` and takes
  its inputs as arguments — no `document`, no `window`, no `localStorage` there.
- **The page script only moves data** between the form and the result. It does not compute.
- **The layout follows the rest of the site**: one workbench, one result readout, at most two action
  buttons. No animation library, no UI framework, no new font.
- **Interface copy is English**, sentence case, and says what will happen rather than how clever it
  is. No exclamation marks, no marketing adjectives.
- **Keep the page small.** A tool is expected to ship only a few kilobytes of gzipped JavaScript; the
  budget gate will tell you when it does not.
- **Test the behaviour you are locking down**, especially edge cases: empty input, input below and
  above the limits, and values that do not parse.

## Code style

- Prettier decides formatting — run `npm run format` rather than arranging code by hand.
- TypeScript is strict; no `any`, no non-null assertion without a reason.
- Functions that can fail on user input return a `Result<T>` instead of throwing.
- No external requests of any kind, and no third-party runtime scripts. Test-only dependencies are
  allowed and must stay in `devDependencies`.

## Commits

Conventional Commits, with the tool slug as the scope where it applies:

```
feat(random-picker): add balanced Teams mode
fix(qr-code): keep the quiet zone at four modules
docs: describe self-hosting in the README
```

## Pull requests

- One tool, or one fix, per pull request.
- Say what changed, and **how to verify it by hand**: what to enter, and what you should see.
- For anything visual, attach a screenshot of the real page.
- Tests should fail before your fix and pass after it.

## License

By contributing, you agree that your work is licensed under Apache-2.0, like the rest of the project.

The Apache-2.0 license does not grant permission to use the name "PlainKit" — forks and derivatives
need to ship under a different name.
