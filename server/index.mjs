import {
  inspect,
  afterRestart,
  source,
  saveSource,
  readJob,
  acquire,
  storage,
  writeJob,
} from "./updater.mjs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomBytes } from "node:crypto";
const startedAt = Date.now();
const port = Number(process.env.PORT || 4319),
  token = randomBytes(32).toString("hex");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin;
  const allowed = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]);
  const json = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  if (
    !["127.0.0.1", "localhost"].includes((req.headers.host || "").split(":")[0])
  )
    return json(403, { error: "Invalid host" });
  if (origin && !allowed.has(origin))
    return json(403, { error: "Origin not allowed" });
  if (url.pathname === "/api/session" && req.method === "GET")
    return json(200, { token });
  if (url.pathname.startsWith("/api/updates")) {
    if (req.headers["x-u-token"] !== token)
      return json(403, { error: "Invalid session" });
    try {
      if (url.pathname === "/api/updates/status" && req.method === "GET")
        return json(200, {
          ...afterRestart(await readJob(process.cwd()), startedAt),
          currentVersion: JSON.parse(await readFile("package.json", "utf8"))
            .version,
          repository: await source(process.cwd()),
        });
      if (url.pathname === "/api/updates/check" && req.method === "POST")
        return json(200, await inspect(process.cwd()));
      if (url.pathname === "/api/updates/source" && req.method === "POST") {
        if ((await readJob(process.cwd())).running)
          return json(409, { error: "An update is running" });
        if (process.env.U_UPDATE_REPOSITORY)
          return json(409, {
            error:
              "The update repository is configured by the server environment",
          });
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1000) throw Error("Source is too long");
        }
        return json(200, {
          repository: await saveSource(
            process.cwd(),
            JSON.parse(raw).repository,
          ),
        });
      }
      if (url.pathname === "/api/updates/install" && req.method === "POST") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1000) throw Error("Invalid update request");
        }
        const expected = JSON.parse(raw || "{}").tag;
        const release = await inspect(process.cwd());
        if (expected !== release.tag)
          return json(409, {
            error: "The release changed. Check for updates again.",
          });
        if (release.state !== "available" || !release.ready)
          return json(409, { error: release.reason || "No update available" });
        const unlock = await acquire(process.cwd());
        try {
          await writeJob(process.cwd(), {
            running: true,
            phase: "starting",
            message: "Preparing update…",
          });
          const child = spawn(
            process.execPath,
            [
              resolve("server/update-worker.mjs"),
              process.cwd(),
              release.tag,
              join(await storage(process.cwd()), "lock"),
            ],
            { cwd: process.cwd(), detached: true, stdio: "ignore" },
          );
          await new Promise((resolve, reject) => {
            child.once("spawn", resolve);
            child.once("error", reject);
          });
          child.once("exit", (code) => {
            if (code && code !== 0) {
              void writeJob(process.cwd(), {
                running: false,
                phase: "failed",
                message: "The update worker stopped unexpectedly.",
              });
              void unlock();
            }
          });
          child.unref();
          return json(202, {
            running: true,
            phase: "starting",
            message: "Preparing update…",
          });
        } catch (e) {
          await writeJob(process.cwd(), {
            running: false,
            phase: "failed",
            message: e.message,
          });
          await unlock();
          throw e;
        }
      }
      return json(404, { error: "Update route not found" });
    } catch (e) {
      return json(400, { error: e.message });
    }
  }
  if (url.pathname === "/api/request" && req.method === "POST") {
    if (req.headers["x-u-token"] !== token)
      return json(403, { error: "Invalid session" });
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 2_000_000)
          throw Error("Request exceeds 2 MB");
      }
      const input = JSON.parse(raw),
        target = new URL(input.url);
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password
      )
        throw Error("Use an HTTP(S) URL without embedded credentials");
      const started = performance.now();
      const disconnected = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) disconnected.abort();
      });
      const response = await fetch(target, {
        method: input.method,
        headers: input.headers,
        body: ["GET", "HEAD"].includes(input.method)
          ? undefined
          : input.body || undefined,
        signal: AbortSignal.any([
          AbortSignal.timeout(30000),
          disconnected.signal,
        ]),
        redirect: "follow",
      });
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body ?? []) {
        size += chunk.length;
        if (size > 5_000_000) throw Error("Response exceeds 5 MB");
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      return json(200, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body,
        duration: Math.round(performance.now() - started),
        size,
      });
    } catch (e) {
      return json(400, { error: e.message });
    }
  }
  if (url.pathname === "/api/demo/login")
    return json(200, {
      token: "u-demo-token",
      user: { id: 1, name: "Tony Stark" },
    });
  if (
    url.pathname === "/api/demo/projects" &&
    req.headers.authorization !== "Bearer u-demo-token"
  )
    return json(401, { error: "Use the demo login token" });
  if (url.pathname === "/api/demo/projects")
    return json(200, {
      projects: [
        { id: 1, name: "Mark VII", status: "active" },
        { id: 2, name: "House Party", status: "ready" },
      ],
    });
  if (url.pathname.startsWith("/api/"))
    return json(404, { error: "Route not found" });
  try {
    const path = resolve("dist", "." + decodeURIComponent(url.pathname));
    if (!path.startsWith(resolve("dist") + "/") && path !== resolve("dist"))
      return json(403, { error: "Invalid path" });
    let data;
    try {
      data = await readFile(path);
      res.setHeader(
        "Content-Type",
        mime[extname(path)] || "application/octet-stream",
      );
    } catch {
      data = await readFile("dist/index.html");
      res.setHeader("Content-Type", "text/html");
    }
    res.end(data);
  } catch {
    json(404, { error: "Run npm run build, or use npm run dev" });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`u API ready at http://127.0.0.1:${port}`),
);
