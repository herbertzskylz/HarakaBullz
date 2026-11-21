# Haraka Bulls

A mobile-friendly family gathering vote. Visitors choose one date: 24, 26, or 31 December 2026, or 8 January 2027. Shared results display each date’s percentage of all votes and identify the leader, including ties. Changing a vote replaces the previous choice.

The site includes a custom bull emblem and a two-second Haraka Bulls splash on the first visit in a browser. It uses an ivory and forest-green design, accessible radio cards, responsive layouts, live results, and native sharing or a copy-link fallback.

## Technologies

- Semantic HTML, CSS, and browser JavaScript; no frontend framework or build step.
- A Netlify Server for `/api/poll` and `/api/vote`.
- Netlify Database with Drizzle ORM for durable shared votes.
- Node.js 24 or newer.

## Local development

Use Node.js 24 and install dependencies with `npm install`. Link the project with `netlify link` if needed, then run `npm run dev`. The Netlify CLI serves the site and its platform integrations at `http://localhost:8889`.

The database connection is managed by Netlify; no database credentials belong in the repository. Database migrations are generated with `npm run db:generate -- --name describe_your_change` and are applied by Netlify during deployment. Do not apply migrations manually.

## Voting behavior

An anonymous, HTTP-only browser cookie identifies a voter. The database enforces one vote per browser identifier. Voting from another browser or clearing cookies creates another identifier, so this is a family coordination poll rather than verified identity voting. Voter identifiers are never included in results.

Each result is `(date votes / total votes) × 100`, rounded to one decimal place. All dates with the highest vote count are joint leaders. Percentages may differ slightly from a combined 100% due to rounding. An empty poll has zero votes and no leader. Results refresh every 15 seconds while the page is visible.

The first-visit splash preference is stored in browser local storage; votes always live in Netlify Database. The poll has no invented starting votes, automatic closing date, or admin interface.
