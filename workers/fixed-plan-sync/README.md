# Fixed plan sync service

This Cloudflare Worker stores only the dashboard's aggregate metrics. Raw Excel rows,
student IDs, and operator names are processed in the browser and are never sent to
the Worker.

The public `GET /api/fixed-plan/latest` endpoint is read-only. Publishing requires
the `PUBLISH_SECRET` secret and is restricted to the dashboard's GitHub Pages origin
plus the local development origins declared in `worker.mjs`.

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
