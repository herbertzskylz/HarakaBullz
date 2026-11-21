# Project architecture

Haraka Bulls is a plain HTML/CSS/JavaScript site with a Netlify Server and Netlify Database. Do not introduce a full-stack frontend framework: a catch-all framework route would shadow the existing server.

## Key directories

- `public/index.html`: semantic page, date radio cards, first-visit splash, share metadata, and information dialog.
- `public/style.css`: forest-green/ivory theme, responsive layouts, accessible interaction states, and reduced-motion behavior.
- `public/script.js`: vote selection, submission, results rendering, polling, sharing, and dialog controls.
- `public/img/bull.svg`: custom vector emblem used in the header, splash, favicon, and footer.
- `netlify/server/index.mjs`: the single server entrypoint; exports a Fetch handler for `/api/*`.
- `db/schema.ts`: source of truth for the Drizzle database schema.
- `db/index.ts`: the managed Drizzle connection.
- `netlify/database/migrations/`: generated schema migrations applied by Netlify at deploy time.
- `drizzle.config.ts`: migration generation configuration.
- `netlify.toml`: static publish directory, Node.js 24, server path, and security headers.

## Conventions and decisions

Use native browser features and semantic HTML. Keep date choices as real radio inputs, with visible keyboard focus and a separate explicit submission. Use CSS custom properties for the theme and honor reduced motion. Never insert API-provided strings as HTML; result rows are generated only from the known date whitelist. Always preserve loading, empty, error, saved, and tied result states.

The four date options are 2026-12-24, 2026-12-26, 2026-12-31, and 2027-01-08. They appear in the HTML, client whitelist, server whitelist, and database check constraint. Update these together, and generate a new named migration for schema changes. Never edit an applied migration.

Each anonymous voter has exactly one database row, keyed by an HTTP-only cookie identifier. Upsert the row to change the chosen date. Do not use local files, local storage, or process memory for votes. Do not expose voter identifiers in API results. Browser local storage is only a presentation preference to suppress the splash after the first visit.

Percentages use each date’s share of all votes, rounded to one decimal place. Leading dates are determined by raw counts, so rounding cannot create false ties. An empty poll must not have a leader. Never add artificial votes to make the page look populated.

The client polls only while visible and ignores outdated responses during submission. Confirm a vote only after the server response. Preserve a pending date selection if refreshes arrive. Vote submission is idempotent for the same browser and date.

Runtime requires Node.js 24. Drizzle must use the beta packages that include the Netlify Database adapter. Netlify handles schema application and deployment validation. No separate frontend build is needed.

Local database imports use explicit `.ts` extensions so the server can resolve the schema with Node.js 24 native TypeScript support as well as with Netlify’s bundler.
