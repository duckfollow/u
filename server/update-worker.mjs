import { inspect, install, writeJob } from "./updater.mjs";
import { rm, writeFile } from "node:fs/promises";
const [root, tag, lockPath] = process.argv.slice(2);
try {
  await writeFile(lockPath, String(process.pid));
  await writeJob(root, {
    running: true,
    phase: "checking",
    message: "Verifying the release…",
  });
  const release = await inspect(root);
  if (release.tag !== tag)
    throw Error("The latest release changed. Check again before updating.");
  const result = await install(root, release, (phase, message) =>
    writeJob(root, { running: true, phase, message, tag }),
  );
  await writeJob(root, {
    running: false,
    phase: "complete",
    message: "Update installed. Restart u, then reload this page.",
    ...result,
  });
} catch (e) {
  await writeJob(root, { running: false, phase: "failed", message: e.message });
} finally {
  await rm(lockPath, { force: true });
}
