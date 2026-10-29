# Security

The dashboard is a static read-only publication. Cloudflare credentials are only used by the collection job and must be stored in GitHub Actions secrets. They are never embedded in browser files, JSON archives or offline downloads.

Use a dedicated Cloudflare token limited to **Zone Analytics Read** and **DNS Read** for `mightora.io`, plus **Account Analytics Read** for the specified account to read browser analytics. No write access is needed. Restrict resources to the account and zone in `config.json`.

Treat all archived hostnames, paths and referrers as untrusted display text. UI rendering escapes data; CSV exports neutralise spreadsheet formula prefixes. Query strings, full referrer URLs, IPs, user IDs and raw user agent strings are not requested. Common identifying path patterns are redacted. Review public data before extending the collected fields.

The offline edition embeds its resources and uses a restrictive Content Security Policy. Online shared Mightora assets are loaded from the official maintained project and jsDelivr. CodeQL results and build checks are evidence, not a guarantee of security.

Report suspected vulnerabilities privately through GitHub's security advisory feature where available. Avoid including API tokens or personal information in public issues.
