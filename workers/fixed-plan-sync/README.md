# Dashboard sync service

This Cloudflare Worker stores the dashboard's aggregate metrics and the latest
generated statistics workbook. Raw source workbooks are processed in the browser
and are never uploaded. The generated workbook can contain student IDs and operator
names, so its upload and download endpoints both require `PUBLISH_SECRET`.

The public `GET /api/fixed-plan/latest` endpoint is read-only. Publishing requires
the `PUBLISH_SECRET` secret and is restricted to the dashboard's GitHub Pages origin
plus the local development origins declared in `worker.mjs`.

`POST /api/fixed-plan/export` stores the latest generated `.xlsx` file after its
data date has been matched against the public dashboard snapshot. Protected
`GET /api/fixed-plan/export` downloads that file. Files are limited to 20 MB and
stored in the existing `FIXED_PLAN_DATA` KV namespace.

The same service also exposes `GET /api/favorites/latest` and a protected `POST`
for the business-favorites dashboard. Only employee-level counts, fixed targets,
and roster display fields are stored. Raw employee-teacher favorite rows remain in
the uploader's browser. The service preserves the first published target for each
employee and carries the prior published day into `previousFavorites`.

Production uses Cloudflare Pages Functions because the company network can reach
`pages.dev` reliably. The standalone Worker configuration is retained for local
testing and as an optional alternative deployment.

Pages deployment:

1. `cd pages`
2. `wrangler pages secret put PUBLISH_SECRET --project-name course-dashboard-fixed-plan-sync-pages`
3. `wrangler pages deploy public --project-name course-dashboard-fixed-plan-sync-pages --branch main`

Optional standalone Worker deployment:

1. `npx wrangler login`
2. `npx wrangler kv namespace create FIXED_PLAN_DATA`
3. Replace the namespace ID in `wrangler.toml`.
4. `npx wrangler secret put PUBLISH_SECRET`
5. `npx wrangler deploy`
6. Put the deployed API URL into `fixed-plan-sync-config.js`.
