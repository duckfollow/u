import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  repository,
  afterRestart,
  newer,
  version,
  command,
  inspect,
  saveSource,
  preflight,
  install,
  acquire,
} from "../server/updater.mjs";
async function fixture(t, broken = false) {
  const base = resolve("work/updater-tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => command(root, "git", args);
  await git("init");
  await git("config", "user.name", "u updater tests");
  await git("config", "user.email", "tests@example.invalid");
  await writeFile(join(root, ".gitignore"), "node_modules/\ndist/\n");
  async function pkg(v) {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "u",
        version: v,
        type: "module",
        scripts: { build: "node build.mjs" },
      }),
    );
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({
        name: "u",
        version: v,
        lockfileVersion: 3,
        requires: true,
        packages: { "": { name: "u", version: v } },
      }),
    );
  }
  await pkg("0.1.0");
  await writeFile(
    join(root, "build.mjs"),
    "import{mkdir,writeFile}from'node:fs/promises';await mkdir('dist',{recursive:true});await writeFile('dist/index.html','new release');",
  );
  await git("add", ".");
  await git("commit", "-m", "initial");
  const head = await git("rev-parse", "HEAD");
  await pkg("0.2.0");
  if (broken)
    await writeFile(
      join(root, "build.mjs"),
      "throw Error('intentional build failure');",
    );
  await git("add", ".");
  await git("commit", "-m", "release");
  await git("tag", "v0.2.0");
  const remote = join(root, ".git", "test-origin.git");
  await command(root, "git", ["clone", "--bare", root, remote]);
  await git("reset", "--hard", head);
  await git("remote", "add", "origin", "https://github.com/u-tests/u.git");
  await git(
    "config",
    `url.${remote}.insteadOf`,
    "https://github.com/u-tests/u.git",
  );
  return { root, head, git };
}
test("repository parser and stable version comparison reject unsupported sources", () => {
  assert.equal(
    repository("https://github.com/duckfollow/u.git"),
    "duckfollow/u",
  );
  assert.equal(repository("git@github.com:duckfollow/u.git"), "duckfollow/u");
  assert.throws(() => repository("https://evil.invalid/u/repo"));
  assert.throws(() => repository("x/../bad"));
  assert.ok(newer("v0.10.0", "0.2.0"));
  assert.equal(newer("v0.1.0", "0.1.0"), false);
  assert.throws(() => version("v1.0.0-beta.1"));
});
test("unconfigured projects do not send a network request", async (t) => {
  const { root } = await fixture(t);
  await command(root, "git", ["remote", "remove", "origin"]);
  const result = await inspect(root, () => {
    throw Error("must not fetch");
  });
  assert.equal(result.state, "unconfigured");
});
test("check reports newer versions, no release, API errors, and dirty worktrees", async (t) => {
  const { root } = await fixture(t);
  await saveSource(root, "u-tests/u");
  const release = await inspect(root, async () => ({
    ok: true,
    json: async () => ({
      tag_name: "v0.2.0",
      body: "Release notes",
      published_at: "2026-10-28",
    }),
  }));
  assert.equal(release.state, "available");
  assert.equal(release.ready, true);
  assert.equal(
    release.releaseUrl,
    "https://github.com/u-tests/u/releases/tag/v0.2.0",
  );
  assert.equal(
    (await inspect(root, async () => ({ status: 404 }))).state,
    "no-release",
  );
  await assert.rejects(
    inspect(root, async () => ({ status: 403, ok: false })),
    /rate limit/,
  );
  await writeFile(join(root, "local.txt"), "uncommitted");
  assert.equal((await preflight(root, "u-tests/u")).ready, false);
});
test("installer builds a staged release then applies it with dependencies and dist", async (t) => {
  const { root, git } = await fixture(t);
  const phases = [];
  const result = await install(
    root,
    {
      state: "available",
      repository: "u-tests/u",
      tag: "v0.2.0",
      latestVersion: "0.2.0",
    },
    async (phase) => phases.push(phase),
  );
  assert.equal(result.restartRequired, true);
  assert.equal(
    JSON.parse(await readFile(join(root, "package.json"), "utf8")).version,
    "0.2.0",
  );
  assert.equal(
    await readFile(join(root, "dist/index.html"), "utf8"),
    "new release",
  );
  assert.ok(phases.includes("building"));
  assert.equal(await git("status", "--porcelain"), "");
});
test("failed staged build leaves current source and version untouched", async (t) => {
  const { root, head, git } = await fixture(t, true);
  await assert.rejects(
    install(root, {
      state: "available",
      repository: "u-tests/u",
      tag: "v0.2.0",
      latestVersion: "0.2.0",
    }),
    /failed/,
  );
  assert.equal(await git("rev-parse", "HEAD"), head);
  assert.equal(
    JSON.parse(await readFile(join(root, "package.json"), "utf8")).version,
    "0.1.0",
  );
});
test("dirty projects refuse installation and concurrent installs are locked", async (t) => {
  const { root } = await fixture(t);
  const unlock = await acquire(root);
  await assert.rejects(acquire(root), /already running/);
  await unlock();
  await writeFile(join(root, "local.txt"), "keep me");
  await assert.rejects(
    install(root, {
      state: "available",
      repository: "u-tests/u",
      tag: "v0.2.0",
      latestVersion: "0.2.0",
    }),
    /commit/,
  );
  assert.equal(await readFile(join(root, "local.txt"), "utf8"), "keep me");
});
test("local edits made during the build prevent application and remain intact", async (t) => {
  const { root, head, git } = await fixture(t);
  await assert.rejects(
    install(
      root,
      {
        state: "available",
        repository: "u-tests/u",
        tag: "v0.2.0",
        latestVersion: "0.2.0",
      },
      async (phase) => {
        if (phase === "building")
          await writeFile(join(root, "local.txt"), "keep new work");
      },
    ),
    /changed during preparation/,
  );
  assert.equal(await git("rev-parse", "HEAD"), head);
  assert.equal(
    await readFile(join(root, "local.txt"), "utf8"),
    "keep new work",
  );
});

test("restart clears the installed job so future updates stay available", () => {
  const job = {
    phase: "complete",
    restartRequired: true,
    updatedAt: "2026-10-28T00:00:00Z",
  };
  assert.equal(
    afterRestart(job, Date.parse("2026-10-28T00:00:01Z")).restartRequired,
    false,
  );
  assert.equal(
    afterRestart(job, Date.parse("2026-10-27T00:00:00Z")).phase,
    "complete",
  );
});
