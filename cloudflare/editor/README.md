# Buckeye Studio

Visual editor for Buckeye Capital Notary. The existing public website remains on GitHub Pages. This new private editor runs in a separate Cloudflare Worker.

## Preview now

Download `Buckeye-Studio-Preview.html` and open it in a desktop browser. Select an element on the canvas, edit its properties in the right panel, then use Preview. Choose Desktop, Tablet, Mobile, or Small mobile before making screen-specific changes. The default scope is the selected screen; “All screens” changes the shared baseline. Existing screen-specific overrides take priority.

Text, links and buttons, images, illustration shapes, backgrounds, borders, divider lines, fonts, spacing, widths, alignment, grid columns and visual positions have controls. Select parent selects a surrounding container. The drag handle changes visual position; grid and spacing controls rearrange layout flow. Text accepts deliberate line breaks. Very narrow screens can still wrap a line that is too wide; reduce the font size or shorten it in that screen's view.

Local Save draft downloads a JSON project; Import project restores it. Keep that project to continue editing. Export downloads website HTML. Local mode does not publish. Preview disables scripts, submissions and external API requests: appointment calculations and form interactions must be tested on a staging or deployed site after a reviewed export. Link URLs and uploaded images are shared across screen sizes; text and visual styles have separate screen overrides.

## Deploy the private editor

Create a **new** Cloudflare Worker named `buckeye-site-editor`. Leave the existing `buckeye-notary-fees` Worker alone. Paste the entire generated `worker.mjs` into its code editor and deploy. The Worker returns a setup error until authentication is configured; it never falls back to a public editor.

1. Configure a Cloudflare Access application protecting the entire new Worker hostname and all paths. Use an allow policy restricted to your own email. Enable Access protection for the workers.dev hostname through the Worker's domain settings if using that hostname. Use a custom editor hostname protected by Access if your dashboard does not expose that option. The server verifies Access tokens even if a hostname is accidentally left unprotected.
2. Add Worker text variables `ACCESS_TEAM_DOMAIN` (your team's `something.cloudflareaccess.com` domain), `ACCESS_AUD` (this Access application's audience tag), and `EDITOR_EMAIL` (the exact email you will sign in with). Use your own email consistently in Access and this variable.
3. Create a Workers KV namespace called `buckeye-editor-drafts` and bind it to this Worker as `EDITOR_DRAFTS`. Saved drafts are private snapshots. Save project downloads as backups too; cloud drafts are not automatically deleted.
4. To enable publishing, create a GitHub fine-grained token restricted to `IDOLAES26/buckeyecapitalnotary` with repository Contents read/write permission. Save it as Worker **secret** `GITHUB_TOKEN`. Enter it directly in Cloudflare, never in this repository, the editor, or chat. Keep `ENABLE_PUBLISH` unset while checking draft editing. Then set `ENABLE_PUBLISH` to `true` when ready to allow reviewed publishing.
5. Sign in to the new editor URL, verify all four screen views, save a draft, reopen it, and use Review & publish only when the result is ready. Publishing checks the original source version and preserves the site's scripts and appointment field names/action. It commits only `index.html` on `main`; GitHub Pages then deploys that commit. A stale draft is blocked rather than overwriting a newer website. Export stale work for a manual merge.

No billing setup is implemented by these files. Usage and availability are governed by your Cloudflare/GitHub account plans. No live browser or deployed Cloudflare test has been completed in this workspace; deployment and a signed-in end-to-end review are still required.

## Build and verify

Run `npm install`, `npm run build`, and `npm test` in this folder. Node 22 or later is recommended. `source.html` is the starting public-site snapshot; the hosted editor fetches current `index.html` from GitHub when opened. `build.mjs` contains the matching initial source SHA: update it when replacing the bundled snapshot. Generated outputs are `Buckeye-Studio-Preview.html` and `worker.mjs`.

Tests cover independent screen copy, repeated export/reopen, preservation of form connections and scripts, rejected unsafe CSS and link protocols, signed Access tokens, expiry and email checks, cross-site request rejection, disabled publishing and missing storage. They do not substitute for browser layout review or a real Access/KV/GitHub publishing test.
