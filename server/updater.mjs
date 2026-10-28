import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  access,
  open,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
const exec = promisify(execFile);
export async function command(root, file, args, timeout = 120000) {
  try {
    return (
      await exec(file, args, {
        cwd: root,
        timeout,
        maxBuffer: 4_000_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      })
    ).stdout.trim();
  } catch (e) {
    throw Error(
      `${file} ${args[0]} failed: ${(e.stderr || e.message).slice(-1200)}`,
    );
  }
}
export function repository(value) {
  const text = String(value ?? "").trim();
  const match = text.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
  );
  if (
    !match ||
    match[1] === "." ||
    match[2] === "." ||
    match[1].includes("..") ||
    match[2].includes("..")
  )
    throw Error("Enter a GitHub repository as owner/repository");
  return `${match[1]}/${match[2]}`;
}
export function version(value) {
  const m = String(value).match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!m) throw Error("Updates require a stable version such as v0.2.0");
  return m.slice(1).map(Number);
}
export function newer(a, b) {
  const x = version(a),
    y = version(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}
export async function storage(root) {
  const path = await command(root, "git", [
    "rev-parse",
    "--git-path",
    "u-updater",
  ]);
  return resolve(root, path);
}
export async function source(root) {
  if (process.env.U_UPDATE_REPOSITORY)
    return repository(process.env.U_UPDATE_REPOSITORY);
  try {
    return repository(
      JSON.parse(
        await readFile(join(await storage(root), "source.json"), "utf8"),
      ).repository,
    );
  } catch {}
  try {
    return repository(
      await command(root, "git", ["config", "--get", "remote.origin.url"]),
    );
  } catch {
    return null;
  }
}
export async function saveSource(root, input) {
  const repo = repository(input),
    dir = await storage(root);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "source.json"),
    JSON.stringify({ repository: repo }),
  );
  return repo;
}
export async function preflight(root, repo) {
  try {
    const head = await command(root, "git", ["rev-parse", "HEAD"]);
    const remote = repository(
      await command(root, "git", ["config", "--get", "remote.origin.url"]),
    );
    if (remote.toLowerCase() !== repo.toLowerCase())
      return {
        ready: false,
        reason: "The project origin must match the release repository.",
      };
    if (await command(root, "git", ["status", "--porcelain"]))
      return {
        ready: false,
        reason: "Save and commit local changes before installing an update.",
      };
    await command(root, "git", ["symbolic-ref", "--quiet", "HEAD"]);
    return { ready: true, head };
  } catch {
    return {
      ready: false,
      reason:
        "Connect this project to its GitHub origin and create an initial commit before installing updates.",
    };
  }
}
export async function inspect(root, fetcher = fetch) {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const repo = await source(root);
  const base = {
    currentVersion: pkg.version,
    repository: repo,
    checkedAt: new Date().toISOString(),
  };
  if (!repo)
    return {
      ...base,
      state: "unconfigured",
      ready: false,
      reason: "Set the GitHub repository that publishes u releases.",
    };
  const eligibility = await preflight(root, repo);
  const response = await fetcher(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "u-updater",
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404)
    return {
      ...base,
      ...eligibility,
      state: "no-release",
      reason:
        "No public stable release was found. Publish a GitHub Release with a version tag.",
    };
  if (!response.ok)
    throw Error(
      response.status === 403 || response.status === 429
        ? "GitHub rate limit reached. Try again later."
        : `GitHub release check failed (${response.status})`,
    );
  const release = await response.json();
  if (
    release.draft ||
    release.prerelease ||
    typeof release.tag_name !== "string"
  )
    throw Error("GitHub returned an invalid stable release");
  version(release.tag_name);
  const available = newer(release.tag_name, pkg.version);
  return {
    ...base,
    ...eligibility,
    state: available ? "available" : "up-to-date",
    tag: release.tag_name,
    latestVersion: release.tag_name.replace(/^v/, ""),
    notes: String(release.body ?? "").slice(0, 20000),
    releaseUrl: `https://github.com/${repo}/releases/tag/${encodeURIComponent(release.tag_name)}`,
    publishedAt: release.published_at,
  };
}
export async function readJob(root) {
  try {
    const state = JSON.parse(
      await readFile(join(await storage(root), "status.json"), "utf8"),
    );
    if (state.running && state.pid) {
      try {
        process.kill(state.pid, 0);
      } catch {
        return {
          ...state,
          running: false,
          phase: "failed",
          message:
            "The update worker stopped unexpectedly. Check the project before retrying.",
        };
      }
    }
    return state;
  } catch {
    return { running: false, phase: "idle" };
  }
}
export async function writeJob(root, state) {
  const dir = await storage(root);
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `status-${process.pid}.tmp`);
  await writeFile(
    tmp,
    JSON.stringify({
      ...state,
      pid: process.pid,
      updatedAt: new Date().toISOString(),
    }),
  );
  await rename(tmp, join(dir, "status.json"));
}
export async function acquire(root) {
  const dir = await storage(root);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "lock");
  try {
    const lock = await open(path, "wx");
    await lock.writeFile(String(process.pid));
    await lock.close();
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let alive = true;
    try {
      const pid = Number(await readFile(path, "utf8"));
      if (!Number.isInteger(pid) || pid <= 0) throw Error("starting");
      process.kill(pid, 0);
    } catch (error) {
      alive = error.code !== "ESRCH";
    }
    if (alive) throw Error("Another update is already running");
    await rm(path, { force: true });
    return acquire(root);
  }
  return () => rm(path, { force: true });
}
export async function install(root, release, report = async () => {}) {
  if (release.state !== "available" || !release.repository)
    throw Error("Check for an available release first");
  version(release.tag);
  const eligible = await preflight(root, release.repository);
  if (!eligible.ready) throw Error(eligible.reason);
  const dir = await storage(root),
    id = randomUUID(),
    stage = join(dir, "stage-" + id),
    ref = "refs/u-updates/" + id;
  let added = false,
    applied = false;
  try {
    await report("fetching", "Fetching the published release…");
    await command(root, "git", [
      "fetch",
      "--no-tags",
      "origin",
      `refs/tags/${release.tag}:${ref}`,
    ]);
    const target = await command(root, "git", ["rev-parse", `${ref}^{commit}`]);
    await command(root, "git", [
      "merge-base",
      "--is-ancestor",
      eligible.head,
      target,
    ]);
    await command(root, "git", ["worktree", "add", "--detach", stage, target]);
    added = true;
    const pkg = JSON.parse(await readFile(join(stage, "package.json"), "utf8"));
    if (pkg.name !== "u" || pkg.version !== release.latestVersion)
      throw Error("Release version does not match the u package");
    await report(
      "building",
      "Preparing and building the release in a separate checkout…",
    );
    await command(
      stage,
      "npm",
      ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
      600000,
    );
    await command(stage, "npm", ["run", "build"], 600000);
    await mkdir(join(stage, "node_modules"), { recursive: true });
    await access(join(stage, "dist", "index.html"));
    const again = await preflight(root, release.repository);
    if (!again.ready || again.head !== eligible.head)
      throw Error(
        "The project changed during preparation. Update was not applied.",
      );
    await report("applying", "Applying the verified release. Keep u open…");
    await command(root, "git", ["merge", "--ff-only", target]);
    applied = true;
    for (const name of ["node_modules", "dist"]) {
      const backup = join(dir, `previous-${id}-${name}`);
      let hadPrevious = false;
      try {
        await rename(join(root, name), backup);
        hadPrevious = true;
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      try {
        await rename(join(stage, name), join(root, name));
      } catch (e) {
        if (hadPrevious) await rename(backup, join(root, name));
        throw e;
      }
    }
    await report(
      "complete",
      "Update installed. Restart u, then reload this page. Your saved workspace stays in this browser.",
    );
    return { version: release.latestVersion, restartRequired: true };
  } catch (e) {
    if (applied)
      throw Error(
        `Release files were applied, but setup did not finish: ${e.message}. Restart only after running npm ci and npm run build successfully.`,
      );
    throw e;
  } finally {
    if (added)
      await command(root, "git", [
        "worktree",
        "remove",
        "--force",
        stage,
      ]).catch(() => {});
    await command(root, "git", ["update-ref", "-d", ref]).catch(() => {});
  }
}

export function afterRestart(job, startedAt) {
  return job.phase === "complete" && Date.parse(job.updatedAt) < startedAt
    ? { ...job, phase: "idle", restartRequired: false }
    : job;
}
