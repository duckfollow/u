# Changelog

## 0.2.2 — 2026-11-09

- Move workspace import and export into the Collections actions menu.
- Keep Theme and Updates directly accessible in both sidebar layouts.
- Align Collections actions and add a Shapes icon and full-width divider.

## 0.2.1 — 2026-11-08

- Fix Flow canvas and Step details clipping by constraining grid rows and giving each panel independent scrolling.
- Add background panning, a reset-view action, and pointer/keyboard step reordering within each execution sequence.

- Combine Import, Export, Theme and Updates into one Workspace tools popover when the sidebar is collapsed.

## 0.2.0 — 2026-11-08

- Add nested collections/folders with rename, drag-and-drop moves/reordering, and shared ellipsis/right-click management menus.
- Add an Examples catalog with Authorization, HTTP Basics, Variables & Environments, and CRUD packs: 31 demo requests and 3 workflows in total, plus local demo reset.
- Generate API documentation for collections and nested folders, capture response examples, and export Markdown documentation.
- Redesign the request workbench with adjustable, independently scrolling Request/Response panels, compact tabs, a separate Send button, inline name editing, and an example-guide popover.
- Add query parameter tables and header tables with enabled/disabled rows, URL synchronization, repeated query keys, and Raw JSON editing.
- Add JSON syntax colors and a lossless Format JSON action; present response status, duration and size separately.
- Compact sidebar navigation and utilities, move request history beside the environment selector, and keep workspace header/footer fixed.
- Preserve existing request edits, workspace imports/exports, example reinstalls, and migrated collection membership.

## 0.1.3 — 2026-11-01

- Redesign the sidebar with clearer navigation, item counts, a collapsible layout, and more space for saved requests and flows.
- Search saved requests and flows together by name, HTTP method, or request URL, with useful empty states.
- Support narrow windows with an expandable sidebar overlay that closes after selecting a menu or item.
- Open Updates in a dialog while keeping the current workspace in place; show version status, release notes, and companion tools.
- Add a View current release action in the desktop app; preserve the web source-checkout installer.

- Delete saved requests from the Collections sidebar with a confirmation dialog and an empty-state action.

- Add Light, Dark, and System appearance modes with a saved per-device preference, live system appearance changes, and matching desktop window chrome.

## 0.1.2 — 2026-10-28

- Add a Tauri/Rust desktop app and macOS DMG build based on Dum-E's project structure.
- Send HTTP natively with cancellation and bounded response sizes; include offline demo endpoints.
- Support desktop GitHub version checks and opening the release page for DMG updates.
- Move Updates and the installed version to the sidebar footer.

## 0.1.1 — 2026-10-28

First public release of u, a local API workbench and workflow studio.

### Added

- Check GitHub Releases at app startup, cache startup results for 15 minutes, and show a New badge in Updates when a newer version exists.
- Display the installed application version in the sidebar.
- Manual release checks, release notes, staged builds before installation, and update progress. Installation requires a clean checkout and a matching GitHub origin; restart u after installing.
- HTTP collections with headers, request bodies, bearer authentication, environments, response details, and request history.
- Sequential flows with HTTP request, transform, condition, and delay steps.
- For Each loops and Repeat N times for repeating complete HTTP processes, including per-round results and error policies.
- Step-by-step execution, cancellation, local persistence, workspace import/export, and shared keyboard-accessible dropdowns.
- MIT license.

### Requirements and limits

- Node.js 24 or later; local browser application.
- Public GitHub Releases with stable version tags for updates.
- Loops run sequentially with a maximum of 100 items or rounds; nested loops are not supported.
