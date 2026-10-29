# Mightora Analytics

Daily Cloudflare analytics, permanently archived as versioned JSON files and published at **https://analytics.mightora.io** on **GitHub Pages**.

## What it does

- Captures each completed UTC day and retries missing records within the source retention window.
- Backfills 365 days of daily HTTP summaries and every detailed breakdown still available to the token and plan.
- Includes all Cloudflare-visible request types: bots, assets, APIs, errors and normal page requests. It does not apply bot, request-source, status or cache exclusion filters.
- Keeps HTTP requests and browser Web Analytics separate. These cannot be added together.
- Shows traffic trends, a yearly activity heatmap, sites, countries, cache, response classes, browsers, devices, paths, referring hosts, protocols and hourly traffic.
- Offers site/date/source filters, CSV and JSON exports, accessible chart tables and a complete offline HTML/ZIP edition.
- Uses the official Mightora header, author block and shared footer, plus genuine links to build/test, CodeQL, source and licence evidence.

## One-time deployment setup

1. In Cloudflare, create a dedicated read-only API token with **Zone → Analytics → Read** and **Zone → DNS → Read** for `mightora.io`, plus **Account → Account Analytics → Read** for the account configured in `config.json`. Check the token can access the Web Analytics dataset. It needs no write permissions.
2. In this repository, open **Settings → Secrets and variables → Actions**. Add the token as **`CLOUDFLARE_API_TOKEN`**. Never place it in a repository file or browser code.
3. Under **Settings → Pages**, set **Source: GitHub Actions** and **Custom domain: analytics.mightora.io**. Set the Cloudflare CNAME for `analytics` to `mightora.github.io`. GitHub must finish domain validation before HTTPS can be enforced. DNS-only is supported for this dashboard; proxying is needed if you want this dashboard's own HTTP requests counted in zone analytics.
4. Run **Actions → Daily archive and Pages → Run workflow** with `365`. Subsequent runs skip complete records. Initial enrichment can take time because the collector respects Cloudflare rate limits.

The workflow runs at **07:23 UTC daily**. GitHub schedules are best effort and can be delayed. GitHub can disable scheduled workflows on inactive public repositories; monitor runs. Successful collection commits and manual activity help keep the repository active. The page displays snapshot age and collection health.

## Counting and honest coverage

An HTTP hit is a request, not a person or a page view. Zone analytics only sees traffic routed through Cloudflare's proxy. DNS-only GitHub Pages sites may have browser Web Analytics observations but have no HTTP edge request count here. A beacon cannot capture every bot or every request, and blockers may suppress it. The coverage table lists the current DNS state of each web hostname.

At initial inspection on 29 October 2026 the account reported roughly 365 days for `httpRequests1dGroups`, 31 days for `httpRequestsAdaptiveGroups`, and 184 days for `rumPageloadEventsAdaptiveGroups`. Settings are discovered on every collection; limits must not be hard-coded as universal guarantees. The oldest partly expired day cannot be reconstructed as a complete day. Data unavailable before collection is marked unavailable, never zero.

Daily summaries retain requests, bytes, cache, threats, encryption, daily unique IPs and all returned country, response-status, content-type and browser-map entries. Adaptive dimensions retain all returned groups; when a result reaches the row limit the collector recursively splits the time window rather than silently archiving a top-N list. Estimated results and shorter coverage windows are labelled. Daily unique IP counts are not summed as unique people across dates.

This is an aggregate analytics archive, not an unsampled raw per-request access log. A guarantee of every individual event would require a supported unsampled logging product and separate storage; past raw events cannot be recreated. Existing DNS-only sites are not reconfigured automatically.

## Data layout and retention

```
data/daily/YYYY/MM/YYYY-MM-DD.json  Permanent daily source data and collection metadata
data/index.json                    File list, availability and SHA-256 hashes
data/dashboard.json                Browser snapshot built from all archived years
data/source-settings.json          Latest discovered dataset limits
data/coverage.json                 DNS coverage snapshot
data/last-run.json                 Latest collection result
```

`data/daily` files are never pruned as years pass. Successful dimensions are skipped. Missing ones are retried; errors do not overwrite successful records. Git history preserves revisions. Git is durable only while the repository and its history are retained: periodically clone it elsewhere for an independent backup. Workflow artifacts expire after one day; the permanent data is in Git, not an expiring Actions artifact.

## Local use

Requires Node.js 22+ and no production npm dependencies.

```sh
node scripts/sync-branding.mjs
npm run build
npm test
```

To collect, set `CLOUDFLARE_API_TOKEN` in the process environment, then run `npm run collect -- --days 365`. Do not put credentials on command lines or commit `.env` files.

Build output is in `dist/`. The root also contains a generated online snapshot for inspection. The build generates the online page and offline download from the same maintained source. Offline: double-click `downloads/mightora-analytics-offline.html`, or unzip the ZIP and open `index.html`.

`node tests/browser-smoke.cjs` performs responsive, keyboard, filter/export and file-URL offline checks when Playwright and Chromium are available. Set `PLAYWRIGHT_MODULE_PATH` if Playwright is supplied outside this checkout. Browser checks are additional to the Node tests; a skipped browser check is not a pass.

## Network transparency

Charts, filters and exports run locally. The online page loads its public JSON from the same origin and official shared branding resources from GitHub and jsDelivr. No collection credential is exposed to visitors. The application adds no advertising or visitor tracking script. The shared header can save a theme preference in localStorage. The offline edition embeds all resources and denies outbound application connections. Developer Tools → Network is the authoritative way to inspect traffic; the in-page Performance Resource Timing summary has limitations.

## Official references

- https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/
- https://developers.cloudflare.com/analytics/graphql-api/limits/
- https://developers.cloudflare.com/analytics/graphql-api/sampling/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

MIT licensed. See `LICENSE` and `SECURITY.md`.
