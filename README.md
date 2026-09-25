# PlainKit

Free everyday tools that run entirely in your browser. No ads, no tracking, no accounts, and nothing
uploaded — every calculation happens on your own device.

Built for people who are not developers: students, office workers, anyone who occasionally needs to
work something out.

## Status

Live at **https://zyphraxns.github.io/plainkit/** (GitHub Pages mirror). Six tools are built;
more are added on a rolling basis.

| Tool                       | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| Final grade calculator     | What you need on the final to hit your target grade                 |
| Countdown card             | Turn a date into a shareable countdown or anniversary card          |
| Date duration calculator   | Days, weeks and weekdays between two dates, with milestones         |
| Random group & name picker | Split a list into random groups, draw names, or shuffle the order   |
| Image to ASCII art         | Turn a picture into ASCII art — copy the text or download a PNG     |
| QR code generator          | Turn a link, Wi-Fi password or contact into a QR code you can print |

Every tool produces something worth sharing — a card, an image, or a line of text you can send to
someone. That is the whole design rule: if nobody would ever share the result, the tool does not get
built.

## Getting started

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev
```

The site runs at `http://localhost:4321`.

## Scripts

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

## Project documentation

This project is built to a written spec. Start here:

| Document                                 | What it covers                                         |
| ---------------------------------------- | ------------------------------------------------------ |
| [`specs/README.md`](specs/README.md)     | Documentation map and the development workflow         |
| [`specs/产品概述.md`](specs/产品概述.md) | What the product is and who it is for                  |
| [`specs/技术栈.md`](specs/技术栈.md)     | Technical choices, and what is deliberately not used   |
| [`specs/项目结构.md`](specs/项目结构.md) | Directory layout and dependency direction rules        |
| [`specs/DESIGN.md`](specs/DESIGN.md)     | Coding standards, design system and performance budget |
| [`PROJECT-BRIEF.md`](PROJECT-BRIEF.md)   | Decision record: research and rejected approaches      |

## License

Apache-2.0. See [LICENSE](LICENSE).

The Apache-2.0 license does not grant permission to use the name "PlainKit".
