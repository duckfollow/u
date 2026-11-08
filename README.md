# u

A local API workbench for organizing collections, exploring APIs, generating documentation, and running sequential workflows. Inspired by the workshop-assistant spirit of U and Dum-E; an original interface, not an official Marvel product.

## Run

Requires Node.js 24 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. The API relay and demonstration endpoints run on 127.0.0.1:4319. Both services bind to loopback only.

For a production build:

```sh
npm run build
npm start
```

Open http://127.0.0.1:4319. Keep the default port for the included demo environment, or update `baseUrl` if you change `PORT`.

## First run

Choose **Workshop onboarding → Run flow**. Three steps authenticate against the local demo, pass the bearer token into the projects request, and extract the projects array. No external account or API key is needed.

- **Next step** executes the next step and retains previous outputs.
- **Run this step** executes the selected step with available prior outputs. Rerunning a step clears downstream results.
- **Run flow** starts fresh; **Stop** cancels the running operation.
- Select a card to edit its request or value. Arrow buttons reorder steps; connections follow that order.
- Use **Configure / Output** to switch between settings and results. On smaller windows, use **Overview / Step details** to switch workspace panels; the selected-step menu lets you move between steps.
- Add HTTP request, transform, boolean condition, or delay steps. A false condition skips the remaining flow. An HTTP error stops execution.

## Variables

Environments contain JSON objects. Use `{{baseUrl}}` in a request URL, headers, body, or bearer token. Query parameters can be entered directly in the URL.

Previous results are available using step IDs displayed in the inspector:

```text
{{steps.login.body.token}}
{{steps.projects.body.projects}}
```

An exact variable reference in a transform preserves JSON types. Other transform values accept literal JSON or interpolated text. Conditions accept `true`, `false`, or a reference resolving to a boolean; arbitrary JavaScript is not executed. Delays accept 0–30000 milliseconds.

## Storage and boundaries

Collections, flows, environment values, and the latest 100 standalone requests persist in this browser's local storage. Flow outputs are temporary. Export/import replaces the entire workspace and includes environment values and tokens. Treat exported files accordingly. Browser storage is unencrypted; this alpha does not provide a credential vault.

The local relay supports HTTP(S), a 30-second timeout, 2 MB request payloads and 5 MB UTF-8 responses. It uses a per-process session token and checks Host and Origin. Requests run from your machine, including access to local APIs. TLS verification stays enabled. No telemetry is included. Google Fonts are optional; system fonts work offline.

u can run as a local web application or a macOS desktop app built with Tauri. Freeform drag-and-connect branching, OAuth, binary/multipart bodies, Postman format import, and multi-workspace management are not implemented yet. Collections currently use a flat saved-request list.

## Verify

```sh
npm run check
npm test
npm run build
```

## For Each loops

Add **For each** to a flow. A new loop includes a **Process item** transform and a two-item sample Array so you can run it immediately. Set the Array field to a previous output, for example `{{steps.projects.body.projects}}`. Add request, transform, condition, and delay steps within its blue group. Loops cannot contain other loops.

Inside a loop, `{{loop.item}}` is the current item and `{{loop.index}}` starts at zero. `{{steps.childId}}` accesses earlier child outputs from the current iteration, while earlier top-level outputs remain available. Child outputs are cleared between iterations. The active loop cannot refer to its own in-progress output.

**Next step** executes one child and pauses, retaining the current iteration. **Run loop** executes the selected loop in full; **Run flow** starts the entire flow fresh. Child steps use Next step rather than running out of context. Stop interrupts the active operation; after an error or stop, Next step restarts that loop from its first item, which may repeat requests already executed. Completed and failed iteration results remain inspectable until a restart or edit.

Loops run sequentially. The default limit is 50 items, configurable from 1 to 100. Inputs over that limit are rejected before any child request runs. Empty Arrays skip execution. Choose to stop on the first error or record it and continue with the next item. A false child condition skips the rest of that item. Continue mode finishes with a warning if any items failed; cancellation always stops.

The Output tab has an iteration picker for both the loop and its children. Downstream steps can access collected results using `{{steps.loopId.iterations.0.steps.childId}}`. Each iteration includes its item, zero-based index, status, outputs, and any error. Run progress counts finished items, including skipped or failed items in continue mode.

### Repeat a process / HTTP requests

Choose **Loop mode → Repeat N times**. Enter a number or an environment reference such as `{{rounds}}`. Every child runs sequentially in every round, so a group containing HTTP request → transform → delay repeats that whole process. `{{loop.number}}` is the one-based round number, `{{loop.index}}` is zero-based, and `{{loop.total}}` gives the round count. In repeat mode, `loop.item` is the zero-based round index. Zero rounds skips the process. Limits, stop/continue behavior, cancellation, per-round results, and Next step work in both modes. Switching modes resets the input field; review it before running.

## License

Copyright (c) 2026 duckfollow.

u is open-source software released under the [MIT License](LICENSE). You may use, modify, and distribute it, including commercially, under the terms in that file.

Third-party dependencies and fonts remain subject to their respective licenses.

## Application updates

Open **Updates** in the sidebar. Enter the public GitHub repository that publishes this project's releases, then choose **Save & check**. A configured Git `origin` is detected automatically. Server administrators may override the source with `U_UPDATE_REPOSITORY=owner/repository`. No repository is assumed for an unconnected project.

The checker uses GitHub's [latest release endpoint](https://docs.github.com/en/rest/releases/releases#get-the-latest-release). It supports stable tags such as `v0.2.0` or `0.2.0`; the tagged `package.json` version must match. Drafts and prereleases are excluded. No GitHub credentials are stored; private repositories are not supported by this release checker. Rate limits and connection errors are shown in the Updates page. The app checks at startup and shows a New badge when a newer release is available. Startup results are cached in this browser for 15 minutes; Check for updates always checks again. No update downloads or installs automatically. Status polling stays on the local machine.

To enable installation, this folder must have an initial commit, a clean working tree (including untracked files), a branch checked out, and an `origin` matching the configured GitHub source. The new release must be a descendant of the current commit so it can be applied with a fast-forward. Publish the source and a versioned GitHub Release in that repository before expecting an available update. This feature does not create a repository or publish releases.

**Install update** fetches the exact release tag, prepares it in a temporary Git worktree, installs dependencies with lifecycle scripts disabled, and runs its production build. Only after that succeeds does the updater check again for local changes, fast-forward the project, and use the prepared dependencies and build. Release build commands execute code from the configured repository; use the project's trusted source. A failed preparation leaves the current checkout untouched. If applying files is interrupted, the page reports the failure and any required repair; application is not a transactional rollback.

The updater runs separately from the web server and records progress under Git's `u-updater` directory, including a lock that prevents concurrent installations. Previous dependency/build folders are retained there. Restart u using your normal launch command after installation, then reload the page. Browser workspace data is unaffected. In development mode, file watching may restart the backend during installation; the detached worker continues, and the Updates page reconnects while polling.

## macOS desktop app (Tauri)

The desktop structure follows Dum-E: React/Vite frontend, Tauri 2/Rust shell, ad-hoc app signing, and DMG bundling. The desktop app sends HTTP requests directly through Rust and needs no separately installed Node.js runtime. Its bundled demo uses `https://demo.u.local` as a local fixture handled inside the app; it makes no network request to that domain.

Build prerequisites are Node.js 24+, Rust, and Xcode Command Line Tools on macOS:

```sh
npm ci
npm run build:dmg
```

The DMG is generated under `src-tauri/target/release/bundle/dmg/`. Development uses `npm run dev:desktop`; native tests use `npm run test:native`. The macOS minimum is 13.5. Builds target the architecture of the machine running the build.

Desktop workspaces persist in the webview for the app identifier `com.duckfollow.u`, separately from the browser version. GitHub release checks work in both versions. Desktop updates open the official release page for downloading a DMG and replacing the app, matching Dum-E's approach; the source-checkout Git updater applies only to the web version.

The generated app is ad-hoc signed and bundle integrity is verified after the build. Developer ID signing and Apple notarization are required for normal public distribution without Gatekeeper prompts; they are not provided by this local build.

## Appearance

Use the **Theme** icon in the sidebar footer to choose **Light**, **Dark**, or **System**. System follows changes to the device appearance automatically. The preference persists on this device, independently of workspace import/export, and is applied before the interface renders. Desktop builds also update the native window appearance.

### Delete saved requests

In Collections, use the trash icon at the right of a saved request in the sidebar. Confirm the request name in the dialog to delete it, or choose Cancel / Escape to keep it. Deletion is permanent and has no Undo. Copies used in flows and request history remain unchanged. On narrow screens, use the trash icon beside the request selector.

## Collections and authorization examples

Open **Collections**, then choose **+ → New collection** beside the heading. Use **⋯** or right-click a collection/folder to create a nested folder or request, rename it, view documentation, or delete it. Drag grips to reorder or move items. The request editor's **Collection** menu shows full paths and can move requests between groups. Requests without a group appear under **Unfiled**. Deletion includes nested folders and offers a choice between keeping requests in Unfiled and deleting them. Built-in example collections default to deleting their requests. Workspace exports preserve the tree and ordering; older workspaces migrate automatically.

Choose **Examples → Authorization → Add authorization examples** to add **Examples / Authorization**, inside the **Examples** folder, containing 15 editable requests: public access, Basic, Bearer, API keys in headers/query parameters, explicit session cookies, cookie + CSRF, OAuth client credentials and refresh-token exchanges, scope checks, and expected 401/403 responses. A separate **Auth · OAuth token → protected API** workflow demonstrates passing an access token between steps. Re-adding the pack preserves existing examples and edits.

These requests run against an **in-app local simulation** at `https://auth-demo.u.local`; they make no network request and work in both web and desktop builds. Demo responses include `x-u-demo: local-simulation`. Tokens, sessions and client credentials are fixed teaching fixtures, with no real authentication, token expiry enforcement, signing, cookie jar or identity provider. Request descriptions explain expected outcomes. Change the URL and replace demo credentials to adapt the request to an actual service; other authorization headers belong in **Headers**, while the **Authorization** tab sets a Bearer token.

The examples follow the request shapes in [HTTP Basic (RFC 7617)](https://www.rfc-editor.org/rfc/rfc7617.html), [Bearer usage (RFC 6750)](https://www.rfc-editor.org/rfc/rfc6750.html) and [OAuth 2.0 token grants (RFC 6749)](https://www.rfc-editor.org/rfc/rfc6749.html). API-key and cookie/CSRF conventions vary by service. JWT validation, authorization code + PKCE, OpenID Connect/SSO, device authorization, Digest, OAuth 1.0, HMAC/AWS SigV4, mTLS and NTLM/Kerberos require additional provider setup or protocol support and are not implemented by this example pack.

### More example packs

Open **Examples**, choose a category, then **Add … examples**:

| Category | Included | How to try it |
| --- | --- | --- |
| HTTP Basics | 8 requests | Send query parameters, custom headers and JSON bodies; compare GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS. The echo endpoint does not change stored data. |
| Variables & Environments | 2 requests, 1 workflow | Adding the pack selects **Examples · Local**. Switch to **Examples · Development** to compare `baseUrl`, `demoName` and `demoLabel`. Run **Examples · Variables → next request** to reuse response values. |
| CRUD Workflow | 6 requests, 1 workflow | Try the numbered requests, or run **Examples · Create → read → update → delete**. The workflow uses the returned project ID and can run repeatedly. |

Each request describes its expected result. These packs use the in-app `https://examples.u.local` simulation in both web and desktop builds, without network requests. CRUD data is stored locally when storage is available; saved requests, workflows, environments and exports are separate from that demo dataset.

Use **Examples → Reset demo data**, then confirm, to restore the initial demo project (ID 1). This preserves saved requests, workflows and environments. Re-adding a pack keeps edits, avoids duplicates and restores its unfiled examples to its collection. Existing environments are never overwritten. Built-in example collections default to deleting their requests when their collection is deleted; the confirmation can retain them instead.

### View API documentation

Choose **⋯ → View documentation** beside any collection or folder to open its generated API documentation. Folder documentation includes every child collection, regardless of the current sidebar search. Expand an endpoint to inspect its method, URL, description, query parameters, headers, Bearer configuration, raw body and template variables. **Open request** returns to its editor.

Documentation reads saved request configuration without sending requests or resolving environment values. It does not infer required fields or response schemas. Edited requests are reflected the next time their documentation is opened.

### Response examples in documentation

Built-in example requests include an **Illustrative demo response** with status, headers and body. These are fixed teaching examples rather than live results; viewing documentation does not execute the request or change demo data.

For your own APIs, send a saved request and choose **Save response example** beneath the response. Its status, headers and body are captured as a separate snapshot, shown under **Response examples** in collection/folder documentation and included in workspace exports. Run and save again to keep additional success or error examples. Saved responses do not change when the live response changes.

### Export Markdown documentation

Open a collection or folder's documentation and click **Export Markdown** to download a `.md` file. The export includes all requests in that scope, descriptions, URLs, query parameters, authorization configuration, headers, bodies, template variables and response examples. Folder exports include all child collections. Saved configuration is exported as written; environment values are not resolved and no API requests are sent.

### Nested folders and drag-and-drop

Collections can contain requests and nested folders. Choose **⋯ → New folder** or **New request** beside a collection/folder. Existing Examples groups are migrated into the same tree without changing saved request content.

Drag the grip beside a request or folder onto another group to move it inside. Drop on the line before a sibling to reorder it; the bottom drop line returns an item to the top level (or Unfiled for requests). Cyclic folder moves are rejected. Focus a grip and use **Alt + Up/Down** to reorder siblings or **Alt + Left** to move up one level. Requests can also move through the editor's Collection menu, which shows their full path.

Folder membership and ordering survive workspace exports/imports. Documentation, Markdown export and collection deletion include nested folders.

### Collection management menu

Use **⋯** beside any collection/folder, or right-click its heading, to open the same management menu: **View documentation**, **New folder**, **New request**, **Rename** and **Delete…**. Rename edits the name inline; press Enter or the checkmark to save, or Escape to cancel. Delete opens the existing confirmation. Unfiled offers documentation and a new request. Menus support arrow keys, **Escape**, and **Shift + F10** on a focused heading.

### Request workbench

The request editor keeps the collection path, editable request name and Method / URL / Send controls above independently scrolling Request and Response panels. Drag the divider or focus it and use Left/Right to adjust the split. Narrow screens stack the panels. Click the **ⓘ** beside a request name to open its example guide.

Headers support **Table** and **Raw JSON** views. Toggle individual table rows off to omit them from requests while retaining their values; disabled headers are included in workspace exports. Duplicate header names are flagged before table changes are saved. The Response panel offers **Body**, **Headers**, **Examples**, and **Save example** beside its tabs.

### Query parameters

Use the request editor's **Params** tab to add, edit, remove or disable query parameters. Enabled rows update the URL immediately; direct URL edits update the table. Repeated keys and `{{variables}}` are supported, and URL fragments are preserved. Disabled parameters remain in the saved request and workspace exports without being sent.

Body JSON supports syntax colors and **Format JSON**, which adjusts whitespace while preserving numeric literals and duplicate keys. Invalid JSON remains unchanged and shows an error. Success appears briefly on the format button. Response status uses a colored badge, with time and size displayed separately. Workspace navigation and connection status stay fixed while editor panels scroll.

### Flow canvas navigation

Overview and Step details stay within the workspace, with independent scrolling so long flows and inspectors remain reachable. Drag blank canvas space to pan, or use its scrollbars. **Reset canvas view** returns to the start. Text on step cards is not selected while dragging.

Drag the grip beside a step above/below another step to change execution order. Loop children reorder within their own loop; steps do not move across loop boundaries. The selected step and all request configuration are preserved, and previous execution results reset after reordering. Focus a grip and use **Alt + Up/Down** for the same operation with a keyboard. Existing inspector Move up/down controls remain available.

When the sidebar is collapsed, its footer uses one **⋯ Workspace tools** control for Import, Export, Light/Dark/System appearance and Updates. An update indicator remains visible on the control. Expanded sidebars keep the four individual utility icons.
