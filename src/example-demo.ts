import type { Result } from "./model.ts";

export const EXAMPLE_DEMO_ORIGIN = "https://examples.u.local";
type Project = { id: number; name: string; status: string };
type Store = { projects: Project[]; nextId: number };
const storageKey = "u-example-demo-data-v1";
const initial = (): Store => ({ projects: [{ id: 1, name: "Demo project", status: "active" }], nextId: 2 });
let store: Store | undefined;
function data(): Store {
  if (store) return store;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (parsed && Array.isArray(parsed.projects) && parsed.projects.every((p: Project) => Number.isInteger(p.id) && typeof p.name === "string" && typeof p.status === "string") && Number.isInteger(parsed.nextId) && parsed.nextId > Math.max(0, ...parsed.projects.map((p: Project) => p.id))) store = parsed;
  } catch { /* In-memory demos also work when storage is unavailable. */ }
  return store ??= initial();
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(data())); } catch { /* Keep the session usable. */ }
}
export function resetExampleDemoData() { store = initial(); save(); }
function response(status: number, body: unknown, extra: Record<string, string> = {}): Result {
  return { status, statusText: ({200:"OK",201:"Created",204:"No Content",400:"Bad Request",404:"Not Found",405:"Method Not Allowed",415:"Unsupported Media Type",422:"Unprocessable Content"} as Record<number,string>)[status], headers: { "content-type": "application/json", "cache-control": "no-store", "x-u-demo": "local-simulation", ...extra }, body, duration: 0, size: body === "" ? 0 : new TextEncoder().encode(JSON.stringify(body)).length };
}
export function exampleDemoResponse(input: { url: string; method: string; headers: Record<string, string>; body: string }): Result | undefined {
  const url = new URL(input.url);
  if (url.origin !== EXAMPLE_DEMO_ORIGIN) return;
  const headers = Object.fromEntries(Object.entries(input.headers).map(([k,v]) => [k.toLowerCase(), v]));
  const env = url.pathname.match(/^\/environments\/(local|development)\/(context|echo)$/);
  if (url.pathname === "/echo" || env) {
    const allowed = "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS";
    if (!allowed.split(", ").includes(input.method)) return response(405, {error:"method_not_allowed"}, {allow: allowed});
    if (input.method === "OPTIONS") return response(204, "", {allow: allowed});
    if (input.method === "HEAD") return response(200, "");
    let body: unknown = input.body || null;
    if (input.body && headers["content-type"]?.split(";")[0].trim() === "application/json") {
      try { body = JSON.parse(input.body); } catch { return response(400, {error: "invalid_json"}); }
    }
    return response(200, { demo: true, method: input.method, query: Object.fromEntries(url.searchParams), headers, body, environment: env?.[1] ?? "local" });
  }
  const match = url.pathname.match(/^\/projects(?:\/(\d+))?$/);
  if (!match) return response(404, {error:"not_found"});
  const id = match[1] ? Number(match[1]) : undefined;
  const allowed = id === undefined ? "GET, POST" : "GET, PUT, PATCH, DELETE";
  if (!allowed.split(", ").includes(input.method)) return response(405, {error:"method_not_allowed"}, {allow: allowed});
  const db = data();
  if (id === undefined && input.method === "GET") return response(200, {projects: structuredClone(db.projects)});
  const index = db.projects.findIndex(p => p.id === id);
  if (id !== undefined && index < 0) return response(404, {error:"project_not_found"});
  if (input.method === "GET") return response(200, structuredClone(db.projects[index]));
  if (input.method === "DELETE") { db.projects.splice(index, 1); save(); return response(204, ""); }
  if (headers["content-type"]?.split(";")[0].trim() !== "application/json") return response(415, {error:"use_application_json"});
  let body: Record<string, unknown>;
  try { body = JSON.parse(input.body); } catch { return response(400, {error:"invalid_json"}); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(422, {error:"body_must_be_object"});
  const full = input.method !== "PATCH";
  if ((full || "name" in body) && (typeof body.name !== "string" || !body.name.trim())) return response(422, {error:"name_is_required"});
  if ((full || "status" in body) && (typeof body.status !== "string" || !body.status.trim())) return response(422, {error:"status_is_required"});
  if (Object.keys(body).some(k => !["name", "status"].includes(k))) return response(422, {error:"unknown_field"});
  if (input.method === "POST") {
    const project = {id: db.nextId++, name: body.name as string, status: body.status as string};
    db.projects.push(project); save();
    return response(201, {...project}, {location: `${EXAMPLE_DEMO_ORIGIN}/projects/${project.id}`});
  }
  db.projects[index] = {...db.projects[index], ...body} as Project;
  save(); return response(200, {...db.projects[index]});
}
