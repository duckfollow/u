# u

A local API workbench with a sequential flow studio. Inspired by the workshop-assistant spirit of U and Dum-E; an original interface, not an official Marvel product.

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

This first version is a local web application. Native desktop packaging, freeform drag-and-connect branching, OAuth, binary/multipart bodies, Postman format import, and multi-workspace management are not implemented yet. Collections currently use a flat saved-request list.

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
