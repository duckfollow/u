import type { RequestSpec, Result, Workspace } from "./model.ts";

export const AUTH_EXAMPLES_COLLECTION = "examples-authorization";
export const EXAMPLES_FOLDER = "Examples";
export function organizeAuthExamples(workspace: Workspace): Workspace {
  if (!workspace.collections?.some(c => c.id === AUTH_EXAMPLES_COLLECTION && c.folder === undefined && c.parentId === undefined)) return workspace;
  return { ...workspace, collections: workspace.collections.map(c => c.id === AUTH_EXAMPLES_COLLECTION && c.folder === undefined && c.parentId === undefined
    ? { ...c, name: c.name === "Examples · Authorization" ? "Authorization" : c.name, folder: EXAMPLES_FOLDER } : c) };
}
export const AUTH_DEMO_ORIGIN = "https://auth-demo.u.local";
const basic = "Basic ZGVtbzp1LWRlbW8tcGFzc3dvcmQ="; // demo:u-demo-password
const client = "Basic dS1kZW1vLWNsaWVudDp1LWRlbW8tc2VjcmV0";
export type AuthExample = { key: string; title: string; description: string; expected: number; method?: string; path: string; headers?: Record<string, string>; body?: string; auth?: string };
export const authExamples: AuthExample[] = [
  { key: "public", title: "No authorization", description: "Public endpoint. No credentials required.", expected: 200, path: "/public" },
  { key: "basic", title: "Basic authentication", description: "Authorization: Basic base64(username:password). Demo username: demo; password: u-demo-password. Use HTTPS for real APIs.", expected: 200, path: "/basic", headers: { Authorization: basic } },
  { key: "bearer", title: "Bearer token", description: "Send an access token through the Authorization tab. Demo token: u-demo-token.", expected: 200, path: "/bearer", auth: "u-demo-token" },
  { key: "key-header", title: "API key · header", description: "Provider-specific X-API-Key header. Demo key: u-demo-key.", expected: 200, path: "/api-key", headers: { "X-API-Key": "u-demo-key" } },
  { key: "key-query", title: "API key · query", description: "Provider-specific api_key query parameter. URLs may be logged; prefer a header when supported.", expected: 200, path: "/api-key?api_key=u-demo-key" },
  { key: "cookie", title: "Session cookie", description: "Explicit Cookie header, without a browser login or cookie jar. Demo session: u-demo-session.", expected: 200, path: "/session", headers: { Cookie: "session=u-demo-session" } },
  { key: "csrf", title: "Cookie + CSRF token", description: "A state-changing request with a session cookie and matching X-CSRF-Token. CSRF protection supplements session authentication.", expected: 200, method: "POST", path: "/csrf", headers: { Cookie: "session=u-demo-session", "X-CSRF-Token": "u-demo-csrf", "Content-Type": "application/json" }, body: '{"name":"Updated project"}' },
  { key: "client-credentials", title: "OAuth 2.0 · client credentials", description: "POST a form-encoded grant with Basic client authentication. Demo client: u-demo-client; secret: u-demo-secret. Returns a simulated access token.", expected: 200, method: "POST", path: "/token", headers: { Authorization: client, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=projects%3Aread" },
  { key: "refresh", title: "OAuth 2.0 · refresh token", description: "Exchange a demo refresh token for a simulated access token. The refresh token belongs in the form body, not the Bearer field.", expected: 200, method: "POST", path: "/token", headers: { Authorization: client, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=u-demo-refresh" },
  { key: "scope", title: "Scope · allowed", description: "Demo read token has projects:read permission.", expected: 200, path: "/scoped", auth: "u-demo-read-token" },
  { key: "missing", title: "401 · missing credentials", description: "Expected failure: protected endpoint without an access token. Inspect WWW-Authenticate in the response.", expected: 401, path: "/bearer" },
  { key: "invalid", title: "401 · invalid token", description: "Expected failure: unrecognized Bearer token.", expected: 401, path: "/bearer", auth: "invalid-demo-token" },
  { key: "expired", title: "401 · expired token", description: "Expected failure: a simulated expired access token. Use the refresh-token example to obtain another token.", expected: 401, path: "/bearer", auth: "u-demo-expired-token" },
  { key: "forbidden", title: "403 · insufficient scope", description: "Expected failure: valid token without projects:read permission.", expected: 403, path: "/scoped", auth: "u-demo-token" },
  { key: "csrf-missing", title: "403 · missing CSRF token", description: "Expected failure: valid session cookie but no CSRF token on a state-changing request.", expected: 403, method: "POST", path: "/csrf", headers: { Cookie: "session=u-demo-session" } },
];
export function exampleRequest(example: AuthExample): RequestSpec {
  return { collectionId: AUTH_EXAMPLES_COLLECTION, id: `auth-example-${example.key}`, name: `Auth · ${example.title}`, method: example.method ?? "GET", url: AUTH_DEMO_ORIGIN + example.path, headers: JSON.stringify(example.headers ?? {}, null, 2), body: example.body ?? "", auth: example.auth ?? "", description: `${example.description}\nLocal simulation · expected HTTP ${example.expected}. Edit or duplicate this request to adapt it to a real API.` };
}
export function addAuthExamples(workspace: Workspace): Workspace {
  workspace = organizeAuthExamples(workspace);
  const exampleIds = new Set(authExamples.map(e => `auth-example-${e.key}`));
  // Restore unfiled pack requests when reinstalling, preserving edits and deliberate moves.
  const savedRequests = workspace.requests.map(r => exampleIds.has(r.id) && !r.collectionId
    ? { ...r, collectionId: AUTH_EXAMPLES_COLLECTION } : r);
  const existing = new Set(savedRequests.map(r => r.id));
  const requests = authExamples.map(exampleRequest).filter(r => !existing.has(r.id));
  const token = exampleRequest(authExamples.find(e => e.key === "client-credentials")!);
  const resource = { ...exampleRequest(authExamples.find(e => e.key === "scope")!), auth: "{{steps.token.body.access_token}}" };
  const flowId = "auth-example-oauth-flow";
  return { ...workspace, collections: workspace.collections?.some(c => c.id === AUTH_EXAMPLES_COLLECTION) ? workspace.collections : [...(workspace.collections ?? []), { id: AUTH_EXAMPLES_COLLECTION, name: "Authorization", folder: EXAMPLES_FOLDER }], requests: [...savedRequests, ...requests], flows: workspace.flows.some(f => f.id === flowId) ? workspace.flows : [...workspace.flows, { id: flowId, name: "Auth · OAuth token → protected API", steps: [ { id: "token", name: "Get access token", kind: "request", request: token, value: "" }, { id: "resource", name: "Read protected resource", kind: "request", request: resource, value: "" } ] }] };
}

/** A deliberately local teaching fixture, not a security implementation or remote server. */
export function authDemoResponse(input: { url: string; method: string; headers: Record<string, string>; body: string }): Result | undefined {
  const url = new URL(input.url);
  if (url.origin !== AUTH_DEMO_ORIGIN) return;
  const h = Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const bearer = h.authorization;
  const session = (h.cookie ?? "").split(";").some(v => v.trim() === "session=u-demo-session");
  let status = 200;
  let body: unknown = { ok: true, demo: true, message: "Authorized in the local simulation" };
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", "x-u-demo": "local-simulation" };
  const fail = (code: number, error: string) => { status = code; body = { error, demo: true }; };
  const methods: Record<string, string> = { "/public": "GET", "/basic": "GET", "/bearer": "GET", "/api-key": "GET", "/session": "GET", "/csrf": "POST", "/token": "POST", "/scoped": "GET" };
  if (!methods[url.pathname]) fail(404, "not_found");
  else if (input.method !== methods[url.pathname]) { fail(405, "method_not_allowed"); headers.allow = methods[url.pathname]; }
  else switch (url.pathname) {
    case "/public": break;
    case "/basic": if (h.authorization !== basic) { fail(401, "invalid_credentials"); headers["www-authenticate"] = 'Basic realm="u demo", charset="UTF-8"'; } break;
    case "/api-key": if (h["x-api-key"] !== "u-demo-key" && url.searchParams.get("api_key") !== "u-demo-key") fail(401, "invalid_api_key"); break;
    case "/session": if (!session) fail(401, "invalid_session"); break;
    case "/csrf": if (!session) fail(401, "invalid_session"); else if (h["x-csrf-token"] !== "u-demo-csrf") fail(403, "invalid_csrf_token"); break;
    case "/token": {
      const form = new URLSearchParams(input.body);
      if (h.authorization !== client) { fail(401, "invalid_client"); headers["www-authenticate"] = 'Basic realm="u demo token"'; }
      else if (h["content-type"]?.split(";")[0].trim() !== "application/x-www-form-urlencoded") fail(400, "invalid_request");
      else if (!["client_credentials", "refresh_token"].includes(form.get("grant_type") ?? "")) fail(400, "unsupported_grant_type");
      else if (form.get("grant_type") === "refresh_token" && form.get("refresh_token") !== "u-demo-refresh") fail(400, "invalid_grant");
      else if (form.has("scope") && form.get("scope") !== "projects:read") fail(400, "invalid_scope");
      else body = { access_token: "u-demo-read-token", token_type: "Bearer", expires_in: 3600, scope: "projects:read", demo: true };
      break;
    }
    case "/bearer":
    case "/scoped":
      if (!["Bearer u-demo-token", "Bearer u-demo-read-token"].includes(bearer)) {
        fail(401, bearer === "Bearer u-demo-expired-token" ? "expired_token" : "invalid_token");
        headers["www-authenticate"] = bearer ? 'Bearer realm="u demo", error="invalid_token"' : 'Bearer realm="u demo"';
      } else if (url.pathname === "/scoped" && bearer !== "Bearer u-demo-read-token") { fail(403, "insufficient_scope"); headers["www-authenticate"] = 'Bearer error="insufficient_scope", scope="projects:read"'; }
      break;
  }
  return { status, statusText: ({200: "OK", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed"} as Record<number, string>)[status], headers, body, duration: 0, size: new TextEncoder().encode(JSON.stringify(body)).length };
}
