# PlainKit

Free everyday tools that run entirely in your browser. No ads, no tracking, no accounts, and nothing
uploaded — every calculation happens on your own device.

Built for people who are not developers: students, office workers, anyone who occasionally needs to
work something out.

**Try it: https://zyphraxns.github.io/plainkit/**

## The tools

| Tool                                                                             | What it does                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Final grade calculator](https://zyphraxns.github.io/plainkit/tools/grade-calculator/)     | What you need on the final to hit your target grade                       |
| [Countdown card](https://zyphraxns.github.io/plainkit/tools/countdown-card/)               | Turn a date into a shareable countdown or anniversary card                |
| [Date duration calculator](https://zyphraxns.github.io/plainkit/tools/date-duration/)       | Days, weeks and weekdays between two dates, with milestones               |
| [Random group & name picker](https://zyphraxns.github.io/plainkit/tools/random-picker/)     | Split a list into random groups, draw names, shuffle it, or make balanced teams |
| [Image to ASCII art](https://zyphraxns.github.io/plainkit/tools/ascii-art/)                 | Turn a picture into ASCII art — copy the text or download a PNG           |
| [QR code generator](https://zyphraxns.github.io/plainkit/tools/qr-code/)                    | Turn a link, Wi-Fi password or contact into a QR code you can print       |

Every tool produces something worth sharing — a card, an image, or a line of text you can send to
someone. That is the design rule for the whole collection: if nobody would ever share the result, the
tool does not get built.

## Why it is different

- **No ads.** Nothing on the site is trying to sell you something.
- **No tracking.** No analytics, no cookies, no third-party scripts.
- **No accounts.** Every tool is open the moment the page loads.
- **Nothing leaves your device.** There is no server to send your data to.

## How it is built

- A static site: Astro and TypeScript, no UI framework and no animation library.
- **Zero runtime dependencies** — everything in `package.json` is a dev dependency.
- A few kilobytes of gzipped JavaScript and CSS per tool page, checked by a performance budget gate.
- Results are deterministic: no tool sends your input to an AI.
- Pages are readable with JavaScript disabled; scripts only move data between the form and the result.
- Served with a strict content security policy; no inline styles or scripts.

## Privacy

Each tool works on files and text you give it, in your browser. Images are decoded locally, lists are
stored in this browser only so you do not have to paste them again, and nothing is transmitted. Open
the network tab and you will see the page load nothing but itself.

## Self-hosting

The build produces a plain folder of static files, so it can be served from anywhere.

With Docker:

```bash
docker compose up
```

The site runs at `http://localhost:8080`.

Without Docker:

```bash
npm install
npm run build
# then serve the contents of dist/ with any static file server
```

## Development

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

The site runs at `http://localhost:4321`.

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the development server                    |
| `npm run build`        | Build the static site into `dist/`              |
| `npm run preview`      | Preview the built site locally                  |
| `npm run typecheck`    | Type-check `.astro` and `.ts` files             |
| `npm test`             | Run the unit tests                              |
| `npm run format`       | Format the code                                 |
| `npm run format:check` | Check formatting without writing                |
| `npm run budget`       | Run the performance budget gate against `dist/` |

## Contributing

Issues and pull requests are welcome. Two rules for a new tool: it must produce something worth
sharing, and it must add no runtime dependency, no tracker and no network request. Before opening a
pull request, run `npm run format`, `npm run typecheck`, `npm test`, `npm run build` and
`npm run budget`.

## License

Apache-2.0. See [LICENSE](LICENSE).

The Apache-2.0 license does not grant permission to use the name "PlainKit".
