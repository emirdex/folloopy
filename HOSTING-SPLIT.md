# Folloopy public website and application

Deploy the same main branch to two independent Hostinger Node.js websites.
Both use Node 22, `npm run build`, output `.`, entry `server.cjs` and APP_MODE=application.
Do not switch the public deployment to APP_MODE=marketing: its existing tracking URLs and database-backed blog must remain available.

Both deployments retain the existing DATABASE_URL, INTERNAL_API_KEY, DATA_ENCRYPTION_KEY,
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, Resend and Google credentials. Never regenerate encryption keys during this move.
Remove ADMIN_SETUP_TOKEN after completed owner setup. SEED_BLOG=false.

Common origin settings:

    SITE_URL=https://folloopy.com
    NEXT_PUBLIC_SITE_URL=https://folloopy.com
    APP_URL=https://panel.folloopy.com
    NEXT_PUBLIC_APP_URL=https://panel.folloopy.com
    PUBLIC_TRACKING_ORIGIN=https://folloopy.com

Public deployment: DEPLOYMENT_ROLE=public, RUN_BACKGROUND_WORKERS=false.
Panel deployment: DEPLOYMENT_ROLE=panel, RUN_BACKGROUND_WORKERS=true.
Exactly one deployment runs background workers. During provisioning leave panel workers false,
then stop public workers before enabling panel workers. New panel sends must wait until this cutover.

Provision panel DNS and a valid HTTPS certificate, deploy and check /health before activating the
split-host settings on the public website. Public origin variables are build-time values; rebuild
both deployments after changing NEXT_PUBLIC_* variables.

In Google Cloud add https://panel.folloopy.com/baglantilar/google/callback as an authorized redirect URI.
Keep the old URI through migration. Existing stored Gmail refresh tokens continue to work; new
OAuth attempts use the panel URI. An OAuth consent already in progress on the old origin must
be restarted on the panel because its host-only session is intentionally not transferred.

Account cookies stay host-only. Users sign in once on the new host. No session tokens are put
in migration URLs. Old password/email confirmation links preserve their fragment through the
GET redirect; credentials and Server Action POST bodies are never redirected cross-host.
The public deployment refuses account API operations even if an old cookie is present.
Public blog, contact/enterprise requests, legal pages, media and legacy tracking remain on the public host.

Validate public and panel health, public CTA destinations, verified/unverified authentication,
plan guards, reset success UI, existing Gmail connection and a HEAD request to an old pixel URL.
