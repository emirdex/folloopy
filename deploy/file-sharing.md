# Tracked file sharing

This feature does not instrument ordinary MIME attachments or local files. The sender explicitly uploads a file and shares a revocable Folloopy URL. Existing mail sending remains plain text plus a safe HTML file-link card. Outlook users can paste the same URL; an Outlook add-in is not implemented.

## Package authority

`packages/domain/file-sharing.ts` is the file-feature policy. Existing account IDs remain `individual` (Essential), `team` (Signature), and legacy `business` (Signature-level file access). Null, unknown, and future `free` plan IDs receive zero file capabilities. This feature does not create or launch the separately proposed Free mail subscription.

| Policy | Free | Essential | Signature |
| --- | --- | --- | --- |
| Files | 0 | 3 PDFs | 100 supported files |
| Per-file bytes | 0 | 10 MiB | 25 MiB |
| Total declared original bytes | 0 | 50 MiB | 2 GiB |
| Share maximum lifetime / visible event history | none | 90 days | 365 days |
| Preview / download requests / browser receipt | none | yes | yes |
| PDF page signals / approximate active time | none | no | yes |
| Password / custom expiration / hide download control | none | no | yes |

Limits are re-read under entitlement locks on every owner operation and every public session/chunk/event request. Uploading files reserve quota immediately. Retrying an identical chunk does not allocate space again; different bytes for the same part are rejected. Downgrades leave stored files intact but deny disallowed public links, file types, sizes and excess files. Oldest eligible files remain accessible. A Signature password or hidden-download share also becomes inaccessible on Essential. Deleting a file releases quota and cascades its chunks, shares and events. Account removal cascades all file data.

Only existing active, verified memberships can use paid file features. Every API operation rejects user-supplied package/workspace fields. The Gmail extension keeps its existing Signature-only eligibility and signed, nonce-protected device transport. Revoked devices, expired/logout sessions, changed senders and downgraded memberships cannot list or share files.

## Storage and transport

Migration 017 adds private PostgreSQL file/chunk/share/session/event tables. Each original file is split into 3 MiB chunks, encrypted independently using AES-256-GCM with the existing stable DATA_ENCRYPTION_KEY. There is no public static upload directory and no new external storage credential. This keeps uploads durable across deployments and keeps each private-transport message below its existing 8 MiB cap. Do not raise that cap for this feature.

The package storage quota counts original bytes; physical database usage is higher because of encryption, indexes, audit records and backups. Monitor PostgreSQL provider capacity/PITR and total application storage before a broad rollout. Storage implementation can be migrated to an encrypted object store without changing public URLs. Protect DATA_ENCRYPTION_KEY: loss makes files unreadable.

Upload states older than 24 hours are cleaned by the existing worker; uploads also clean their own workspace's stale reservations. Sessions expire after two hours; maintenance removes sessions a day after expiration and raw events older than 365 days. Essential reports only show its latest 90 days. Expired/revoked links are denied server-side even before cleanup runs.

## Measurement semantics

- Link landing GETs are raw access signals. HEAD creates no event. Password-protected metadata does not reveal the filename before access is granted.
- Browser preview is recorded after rendering, while the preview intersects the visible viewport and the document has focus.
- PDF pages are recorded after the selected page is rendered. A page is deduplicated per viewing session.
- Active-time heartbeats require a visible, focused preview and recent interaction; each server-accepted increment is limited to 15 seconds and elapsed session time. These client signals can be imprecise/spoofed and are not reading proof.
- Download request and receipt of all chunks in the browser are separate records. The browser receipt never means a file was saved to disk or opened locally. Requesting only some chunks cannot produce a receipt event. Repeated receipts are deduplicated.
- Sources are `suspected_automated` (user-agent/prefetch heuristic) or `unverified_browser`; neither proves a person's identity. Recipient labels are labels, not verified identities. Forwarding a bearer link transfers access. No IP/location fingerprinting is collected.
- Hiding the download button cannot prevent screenshots or copying data used for a preview. The UI says so.

PDF.js, its worker, CMaps, fonts and WASM are bundled locally and loaded only by the recipient viewer. PDFs use canvas rendering with XFA disabled; no document scripts/interactive links are executed. DOCX, XLSX and PPTX receive a bounded, text-only client preview through ZIP/XML parsing (20 MiB selected XML total, 4 MiB per part); styling, formulas, charts and layout are not reconstructed. No external Office viewer receives customer files. ZIP has no preview and requires an explicit download. Executables, HTML and SVG uploads are rejected by the extension allowlist; basic magic-byte checks reject disguised allowed files. This is not an antivirus guarantee.

## Verification and release

`npm run typecheck`, `npm test`, `npm run build` cover policies, concurrent quotas, encryption, private ownership, downgrade/revocation/expiry, password access, event boundaries, full download receipt, pagination, strict API schemas and signed extension file operations.

Optional real browser smoke: after a production build, set WORKSPACE_NODE_MODULES to a runtime containing Playwright/pdf-lib and run `NODE_ENV=production node --import tsx scripts/file-sharing-web-smoke.ts`. It starts a disposable embedded database and local Next instance, sends no email and never touches production. It checks Free denial, Essential/Signature upload/share/preview/download, PDF pages, Office/ZIP, compose insertion, mobile overflow, and panel navigation. CHROME_PATH can select a local Chrome binary.

The Chrome extension is version 1.0.6. Unpacked/manual installations require reloading the extension to receive its file selector. A source change does not prove Chrome Web Store publication or real Gmail acceptance. Preserve production credentials, existing design styles and existing member data during deployment; verify production health and page assets after rollout.

## Transient cleanup

The existing maintenance worker also removes expired extension pairing requests, old replay nonces and revoked/expired extension devices. It does not delete active login sessions, member data, messages or uploaded files. Expired upload reservations and recipient sessions use the file cleanup described above. The build now removes reproducible Webpack/SWC/Turbopack compilation caches after compilation; runtime static assets, image/data caches and user uploads remain intact. Test execution is capped at four concurrent files to avoid unnecessary local/CI memory spikes.
