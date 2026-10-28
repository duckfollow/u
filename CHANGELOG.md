# Changelog

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
