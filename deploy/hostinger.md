# Folloopy — Hostinger Business Node.js

Target: https://folloopy.com. This is the application setup guide, not evidence of a completed deployment.

## Architecture

One Hostinger Node application runs `server.cjs` / `npm start`. The entry process opens the public HTTP listener immediately to satisfy Hostinger's startup deadline, holding incoming requests for up to 30 seconds until initialization completes. Startup failure or timeout returns an uncached 503. It initializes the private Fastify API and background worker in the same Node process, verifies database health, then prepares Next.js. Internal requests use Fastify injection through a process-local adapter, preserving all bearer, session, schema and role checks. The API opens no TCP listener and requires no child process or IPC handshake in this deployment. Only Next.js is public. Local development retains its loopback HTTP API. Shutdown drains public requests and closes the worker, private API and database pool. Use one application instance; do not run a separate production worker alongside it.

An external PostgreSQL service (for example Supabase/Neon) is required. Hostinger Business's SQL offering must not be assumed to be PostgreSQL. Choose a region consistent with the privacy documents. Use a direct or session-pool connection and provider-required TLS. No PGlite database is permitted in production. API migrations run transactionally before readiness and take a PostgreSQL advisory lock. The application account needs migration privileges; restrict them separately if your deployment pipeline applies migrations before runtime.

Blog PNG/JPEG/WebP files are stored in PostgreSQL, alongside the accounts and articles, so redeploying the application cannot delete uploads. Files are limited to 5 MiB and restricted to the authenticated owner. Images are public once uploaded; do not upload private documents. Daily database backups include images. Monitor database storage capacity.

## Create the deployment

1. Create a private GitHub repository containing only source, package-lock.json, public brand assets and deployment files. Exclude .data, .env files, work, screenshots, database dumps and node_modules. CI validates typecheck, tests and build. Protect main and require CI to pass before merging: Hostinger auto-deploys main pushes and does not inherently wait for GitHub CI.
2. hPanel → Node.js Web Application → GitHub repository. Use Node 22.22 or newer supported 22.x. This monorepo starts both API and web: choose **Other** rather than deploying only apps/web as a standalone Next app. Project root is repository root. Build `npm run build`; entry `server.cjs`; start `npm start` if hPanel offers a start command. Next output is `apps/web/.next`. Do not use static export.
3. Copy the variable names from .env.production.example into hPanel. Generate three independent secrets: `openssl rand -hex 32` for INTERNAL_API_KEY and `openssl rand -base64 32` separately for DATA_ENCRYPTION_KEY and NEXT_SERVER_ACTIONS_ENCRYPTION_KEY. Do not paste secrets into source, a public issue, logs or this guide. Persist the encryption keys across deployments; losing DATA_ENCRYPTION_KEY makes saved OAuth credentials and pending email payloads unreadable.
4. Provide external DATABASE_URL, Resend key and verified MAIL_FROM. Configure Resend's domain DNS records in the DNS provider. Test deliverability to Gmail and Outlook; verify SPF/DKIM/DMARC results. Outbound account emails are queued, encrypted, sent with idempotency keys and retried up to five times. Failed mail requires operator investigation; monitor mail_outbox counts, not payload contents.
5. Set ADMIN_OWNER_EMAIL and a one-time random ADMIN_SETUP_TOKEN to enable initial owner setup. Open /admin/kurulum, enter the token directly, choose the owner password. Setup closes after one successful activation. Remove ADMIN_SETUP_TOKEN from hPanel. Without a token there is no public owner creation path. Never reuse a local development setup key in production.
6. BILLING_MODE defaults to disabled. `complimentary` enables package access without charging and records it separately from purchases. It must not be described as a paid subscription. There is no payment gateway or webhook implementation in this release.
7. For real Gmail sending, create a Google Cloud OAuth web client, enable Gmail API and register exactly `https://folloopy.com/baglantilar/google/callback`. Configure client ID and secret. The app requests openid, email and gmail.send; it does not read inbox contents. Complete Google's consent-screen/domain/app verification requirements before general availability. Pending Google testing-mode limits apply until Google approves the app.
8. Attach folloopy.com and www to the application following hPanel DNS instructions, enable SSL and redirect www to the canonical hostname. Do not overwrite existing MX records when attaching the website. Configure the platform to redirect HTTP to HTTPS.
9. Run `npm run preflight` with the deployed environment after migrations. Confirm /health returns 200, account signup, verification, password reset, logout, protected admin access, blog upload across redeploy and real Gmail delivery/open collector behavior. Do not count mock tests as actual provider acceptance.

## Account/security behavior

Production ignores the old visitor preview cookie and refuses anonymous workspace access. Each member has a separate workspace. Unverified accounts, including owners, cannot activate a package, use private account APIs, connect Gmail, upload admin media or access either panel. Existing unverified owners must complete the same email-code flow before returning to admin. The owner setup token grants the role, not email verification. Password reset tokens expire in 30 minutes, registration verification uses an account-bound six-digit code that expires in 10 minutes, locks after five wrong attempts and permits resend after 60 seconds. Code digests use the application encryption key with HMAC; mail payloads remain encrypted in the outbox. Legacy verification links remain valid until their existing expiry. Reset tokens are hashed at rest and one-use. Reset invalidates all existing sessions and pending OAuth states. Legacy verification links are bound to the signed-in account. Password checks/session creation and recovery/email-change writes serialize on the user row. OAuth completion rechecks the session and consumes state atomically after the provider response; disconnect cancels pending states so an in-flight callback cannot reconnect the account. Cookies are Secure/HttpOnly/SameSite=Lax. Server Actions provide origin validation and the custom upload route verifies canonical origin. API credentials and OAuth refresh tokens never go to the browser. Request logs do not contain credentials or callback codes.

Only Essential and Signature can be self-activated in complimentary mode; Enterprise remains a sales/contact flow. Package changes preserve consumed quota and cannot reactivate suspended access. Local purchase simulation is rejected by the production account service as well as the API.

Validation: `npm test`, `npm run typecheck`, `npm run build`, then `NODE_ENV=production node --import tsx scripts/security-web-smoke.ts` runs real HTTP checks against a disposable local Next server and synthetic accounts. It does not send email or touch production data. Set `TEST_DATABASE_URL` only to a dedicated test PostgreSQL database for the optional real-PostgreSQL test; never point it at production.

Persistent limits protect authentication and public enterprise requests. Hostinger/WAF should also enforce per-IP request and upload limits, especially on login, registration, account emails and /t/o/*.gif; the API only trusts its local Next server. These application limits complement that perimeter.

## Backup / restore

Enable the PostgreSQL provider's automatic backups/PITR, plus a daily off-site backup. `BACKUP_DIR=/secure/off-repo/path DATABASE_URL=... sh scripts/backup.sh` creates a custom pg_dump including media. Supply the secret via the environment, not a command saved into shared logs. Encrypt backups and restrict access. Keep DATA_ENCRYPTION_KEY separately in a password manager.

Restore into a **new empty staging database**, never overwrite production while testing: `pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" /secure/backup.dump`. Run preflight against that restored database, sign in with a staging account and open an uploaded image. Record restore timing. A backup is not verified until restoration succeeds.

## Existing local data

Do not upload .data or import example/test users into production. Use a clean production database and owner setup. For intentionally retained editorial content/images, use scripts/import-blog-media.ts against a stopped development copy or the explicit source media folder; then create/import approved articles through admin. Preserve local snapshots separately. Never open a running PGlite directory from another process.

## Monitoring and rollback

Monitor HTTPS /health, process restarts, PostgreSQL storage/connections, pending/failed mail_outbox, collector failures and unknown send outcomes. Health reports no secrets. Do not automatically resend uncertain Gmail submissions. Roll back code by reverting main; database migrations are additive and data should not be rolled back by deleting volumes. Take a backup before schema changes. Old HTML after a new build can require a page refresh for Server Actions; keep the same action encryption key.

## Explicit limits before a public launch

No claim is made that hosting, DNS, database credentials, email deliverability, Google verification or real payment acceptance has been completed. Document-view/download analytics, reply tracking, the browser extension and Outlook sending are not implemented. Do not promise these as working package features. Legal documents must reflect actual data locations, vendors, billing terms and the applicable transfer arrangements; the current wording is not a legal sign-off. Use an invited pilot until these launch requirements are validated.

## Public website first (no accounts or secrets)

With no APP_MODE configured, production runs in marketing mode. npm start starts only Next.js on the platform PORT; no database/API/worker is launched. Public articles use the repository's editorial seed content; new admin edits are unavailable. Account/checkout routes redirect to contact, admin/panel/OAuth/collector endpoints return 404, enterprise contact is a mailto link rather than a form that claims to save data. Do not paste placeholders into hPanel. Remove auto-detected development env rows if using this mode. To enable the full application later set APP_MODE=application and provide all required production variables first.

## Hostinger GLIBC / SWC compatibility

Build uses `next build apps/web --webpack` and next.config.mjs so configuration loading does not require TypeScript transformation. @next/swc-wasm-nodejs is pinned to the same Next.js version; Next can fall back to WASM when a host's glibc cannot load native SWC. Turbopack does not support this fallback for the production build. The Webpack build was exercised with Next's WASM-first path locally; Hostinger deployment still needs separate acceptance. No host library replacement or certificate/security bypass is required.

## Runtime 503 / Passenger entry point

server.cjs now creates the public HTTP server in its own process, rather than spawning next start in a child. This permits process managers that intercept http.Server.listen (such as Passenger) to attach the public socket. Marketing mode does not require tsx at runtime; tsx is a runtime dependency for the full application's private API. If 503 persists, inspect application startup stderr: FOLLOOPY_START_FAILED, missing build files/dependencies, process limits and the configured entry path. A successful build does not prove that the runtime started.

## Restore the full application without payments

Prepare PostgreSQL, verified Resend sender and Google OAuth before switching the live mode. Keep the same `DATA_ENCRYPTION_KEY` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` after the first launch. Never replace an existing database with the local development database.

In hPanel, use `.env.production.example` as the variable-name template and provide the real values privately. The temporary launch uses `APP_MODE=application`, `BILLING_MODE=complimentary` and `SEED_BLOG=true`. Complimentary activation gives verified users access without collecting money or creating a paid purchase. Checkout explicitly states that no payment is taken. Set `SEED_BLOG=false` after initialization; seeding inserts missing slugs and does not overwrite existing articles.

Application mode restores the login/register links, account recovery, package selection, Enterprise request form, private user panel, admin, database-backed blog/media and tracking routes. Changing the flag alone does not configure external services. Deploy after all required variables are present; startup validates configuration and migrates the database before opening the public listener.

Acceptance: `/health` succeeds; signup email arrives and verifies the account; login and password reset work; a package can be activated with no paid purchase recorded; an Enterprise request reaches admin; a blog image survives redeployment; Gmail OAuth connects the real sender and a tracked test message can be sent to an address the operator controls. These provider checks must be carried out in the live environment. Signature document/link analytics and reminders remain unfinished and are not enabled by this mode switch.
