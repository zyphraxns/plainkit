# PlainKit

Free everyday tools that run entirely in your browser. No ads, no tracking, no accounts, and nothing
uploaded — every calculation happens on your own device.

Built for people who are not developers: students, office workers, anyone who occasionally needs to
work something out.

## Status

Early development. The site skeleton is in place; the first tools are being built.

Planned for the first release:

1. Final grade calculator
2. Countdown / anniversary card
3. Date duration calculator
4. Random grouping and drawing
5. Chemistry tools (equation balancing, molar mass)

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
