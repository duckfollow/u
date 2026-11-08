import { descendants, validCollectionTree } from "./collection-tree.ts";
import { exampleDemoResponse } from "./example-demo.ts";
import { authDemoResponse } from "./auth-examples.ts";
import { isDesktop, nativeRequest } from "./native.ts";
export type ResponseExample = {
  id: string; name: string; status: number; statusText: string; headers: Record<string, string>; body: unknown;
};
export type RequestSpec = {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: string;
  disabledHeaders?: Record<string,string>;
  disabledParams?: {key:string;value:string}[];
  body: string;
  auth: string;
  responseExamples?: ResponseExample[];
  description?: string;
  collectionId?: string;
};
export type Step = {
  id: string;
  name: string;
  kind: "request" | "transform" | "condition" | "delay" | "loop";
  children?: Step[];
  loop?: {
    mode?: "each" | "repeat";
    maxIterations: number;
    errorMode: "stop" | "continue";
  };
  request: RequestSpec;
  value: string;
};
export type Result = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  size: number;
};
export type Flow = { id: string; name: string; steps: Step[] };
export type Workspace = {
  version: 1;
  requests: RequestSpec[];
  collections?: { id: string; name: string; folder?: string; parentId?: string }[];
  flows: Flow[];
  environments: Record<string, string>;
  environment: string;
  history: {
    name: string;
    method: string;
    url: string;
    status: number;
    time: string;
  }[];
};
export const uid = () => crypto.randomUUID();
export const request = (name = "Untitled request"): RequestSpec => ({
  id: uid(),
  name,
  method: "GET",
  url: "{{baseUrl}}/api/demo/projects",
  headers: "{}",
  body: "",
  auth: "",
});
export function seed(): Workspace {
  const login = {
    ...request("Authenticate"),
    url: "{{baseUrl}}/api/demo/login",
    method: "POST",
    body: "{}",
  };
  const projects = {
    ...request("List projects"),
    auth: "{{steps.login.body.token}}",
  };
  return {
    version: 1,
    requests: [login, { ...projects, auth: "u-demo-token" }],
    flows: [
      {
        id: uid(),
        name: "Workshop onboarding",
        steps: [
          {
            id: "login",
            name: "Authenticate",
            kind: "request",
            request: login,
            value: "",
          },
          {
            id: "projects",
            name: "Fetch projects",
            kind: "request",
            request: projects,
            value: "",
          },
          {
            id: "extract",
            name: "Prepare results",
            kind: "transform",
            request: request(),
            value: "{{steps.projects.body.projects}}",
          },
        ],
      },
    ],
    environments: {
      Local: JSON.stringify(
        {
          baseUrl: isDesktop()
            ? "https://demo.u.local"
            : typeof location === "undefined"
              ? "http://127.0.0.1:4319"
              : location.origin,
        },
        null,
        2,
      ),
      Development: '{\n  "baseUrl": "https://example.com"\n}',
      Production: '{\n  "baseUrl": "https://example.com"\n}',
    },
    environment: "Local",
    history: [],
  };
}
export function lookup(path: string, context: unknown): unknown {
  return path
    .trim()
    .split(".")
    .reduce((value: unknown, key) => {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error("Invalid variable path");
      if (
        value === null ||
        typeof value !== "object" ||
        !Object.hasOwn(value, key)
      )
        throw Error(`Variable not found: ${path}`);
      return (value as Record<string, unknown>)[key];
    }, context);
}
export function interpolate(input: string, context: unknown): string {
  return input.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
    const value = lookup(path, context);
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
export function resolveValue(input: string, context: unknown): unknown {
  const exact = input.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
  if (exact) return lookup(exact[1], context);
  const text = interpolate(input, context);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
export function variables(workspace: Workspace): Record<string, unknown> {
  const value = JSON.parse(workspace.environments[workspace.environment]);
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw Error("Environment must be a JSON object");
  return value;
}
export async function send(
  spec: RequestSpec,
  context: unknown,
  signal?: AbortSignal,
): Promise<Result> {
  const headers = JSON.parse(interpolate(spec.headers || "{}", context));
  if (
    !headers ||
    typeof headers !== "object" ||
    Array.isArray(headers) ||
    Object.values(headers).some((v) => typeof v !== "string")
  )
    throw Error("Headers must be a JSON object with string values");
  if (spec.auth)
    headers.Authorization = `Bearer ${interpolate(spec.auth, context)}`;
  signal?.throwIfAborted();
  const resolved = {
    url: interpolate(spec.url, context), method: spec.method, headers,
    body: interpolate(spec.body, context),
  };
  const demo = authDemoResponse(resolved) ?? exampleDemoResponse(resolved);
  if (demo) return demo;
  if (isDesktop()) {
    const result = (await nativeRequest(
      {
        url: interpolate(spec.url, context),
        method: spec.method,
        headers,
        body: interpolate(spec.body, context),
      },
      signal,
    )) as Result;
    try {
      result.body = JSON.parse(result.body as string);
    } catch {}
    return result;
  }
  const session = await fetch("/api/session", { signal }).then((r) => r.json());
  const response = await fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-U-Token": session.token },
    body: JSON.stringify({
      url: interpolate(spec.url, context),
      method: spec.method,
      headers,
      body: interpolate(spec.body, context),
    }),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Request failed");
  try {
    result.body = JSON.parse(result.body);
  } catch {}
  return result;
}
export function validateWorkspace(value: unknown): value is Workspace {
  const w = value as Workspace;
  return (
    !!w &&
    w.version === 1 &&
    Array.isArray(w.requests) &&
    w.requests.every(validRequest) &&
    (w.collections === undefined || (
      Array.isArray(w.collections) &&
      w.collections.every(c => !!c && typeof c.id === "string" && !!c.id && typeof c.name === "string" && !!c.name.trim() && (c.folder === undefined || (typeof c.folder === "string" && !!c.folder.trim()))) &&
      new Set(w.collections.map(c => c.id)).size === w.collections.length &&
      validCollectionTree(w.collections)
    )) &&
    w.requests.every(r => r.collectionId === undefined || !!w.collections?.some(c => c.id === r.collectionId)) &&
    Array.isArray(w.flows) &&
    w.flows.every(
      (f) =>
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        Array.isArray(f.steps) &&
        validSteps(f.steps),
    ) &&
    !!w.environments &&
    typeof w.environments === "object" &&
    Object.values(w.environments).every((v) => typeof v === "string") &&
    typeof w.environment === "string" &&
    Object.hasOwn(w.environments, w.environment) &&
    Array.isArray(w.history) &&
    w.history.every(
      (h) =>
        typeof h.name === "string" &&
        typeof h.method === "string" &&
        typeof h.url === "string" &&
        typeof h.status === "number" &&
        typeof h.time === "string",
    )
  );
}
export function validSteps(steps: Step[]): boolean {
  const ids = new Set<string>();
  function check(s: Step, child = false): boolean {
    if (
      !s ||
      typeof s.id !== "string" ||
      !/^[a-zA-Z][\w-]*$/.test(s.id) ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      typeof s.value !== "string" ||
      !validRequest(s.request)
    )
      return false;
    ids.add(s.id);
    if (s.kind === "loop")
      return (
        !child &&
        !!s.loop &&
        (s.loop.mode === undefined ||
          ["each", "repeat"].includes(s.loop.mode)) &&
        Number.isInteger(s.loop.maxIterations) &&
        s.loop.maxIterations >= 1 &&
        s.loop.maxIterations <= 100 &&
        ["stop", "continue"].includes(s.loop.errorMode) &&
        Array.isArray(s.children) &&
        s.children.every((c) => check(c, true))
      );
    return (
      ["request", "transform", "condition", "delay"].includes(s.kind) &&
      s.children === undefined &&
      s.loop === undefined
    );
  }
  return steps.every((s) => check(s));
}
function validRequest(r: RequestSpec) {
  return (
    !!r &&
    ["id", "name", "method", "url", "headers", "body", "auth"].every(
      (k) => typeof r[k as keyof RequestSpec] === "string",
    ) &&
    (r.disabledParams === undefined || (Array.isArray(r.disabledParams) && r.disabledParams.every(p => !!p && typeof p.key === "string" && typeof p.value === "string"))) &&
    (r.disabledHeaders === undefined || (!!r.disabledHeaders && typeof r.disabledHeaders === "object" && !Array.isArray(r.disabledHeaders) && Object.values(r.disabledHeaders).every(v => typeof v === "string"))) &&
    (r.responseExamples === undefined || (Array.isArray(r.responseExamples) && r.responseExamples.every(e =>
      !!e && typeof e.id === "string" && typeof e.name === "string" && Number.isInteger(e.status) && e.status >= 100 && e.status <= 599 && typeof e.statusText === "string" &&
      !!e.headers && typeof e.headers === "object" && !Array.isArray(e.headers) && Object.values(e.headers).every(v => typeof v === "string") && Object.hasOwn(e, "body")
    ))) &&
    (r.collectionId === undefined || typeof r.collectionId === "string") &&
    (r.description === undefined || typeof r.description === "string") &&
    ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
      r.method,
    )
  );
}
export async function executeStep(
  step: Step,
  context: unknown,
  signal: AbortSignal,
  sender = send,
): Promise<unknown> {
  signal.throwIfAborted();
  if (step.kind === "loop")
    throw Error("Use the flow runner to execute a loop");
  if (step.kind === "request") {
    const result = await sender(step.request, context, signal);
    if (result.status >= 400)
      throw Error(`HTTP ${result.status}: ${result.statusText}`);
    return result;
  }
  if (step.kind === "delay") {
    const ms = Number(interpolate(step.value, context));
    if (!Number.isFinite(ms) || ms < 0 || ms > 30000)
      throw Error("Delay must be between 0 and 30000 ms");
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Stopped", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, ms);
      signal.addEventListener("abort", abort, { once: true });
    });
    return { waited: ms };
  }
  const result = resolveValue(step.value, context);
  if (step.kind === "condition" && typeof result !== "boolean")
    throw Error("Condition must resolve to true or false");
  return result;
}

export function removeCollection(workspace: Workspace, collectionId: string, deleteRequests = false): Workspace {
  if (!workspace.collections?.some(c => c.id === collectionId)) return workspace;
  const ids = descendants(workspace.collections, collectionId);
  return {
    ...workspace,
    collections: workspace.collections.filter(c => !ids.has(c.id)),
    requests: deleteRequests
      ? workspace.requests.filter(r => !ids.has(r.collectionId ?? ""))
      : workspace.requests.map(r => {
          if (!ids.has(r.collectionId ?? "")) return r;
          const { collectionId: removed, ...request } = r;
          return request;
        }),
  };
}
