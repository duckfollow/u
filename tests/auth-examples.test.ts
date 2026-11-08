import { test } from "node:test";
import assert from "node:assert/strict";
import { addAuthExamples, authExamples, authDemoResponse, AUTH_DEMO_ORIGIN, exampleRequest, organizeAuthExamples } from "../src/auth-examples.ts";
import { seed, send, variables, validateWorkspace, executeStep } from "../src/model.ts";

test("all authorization examples produce their documented status without network access", async () => {
  for (const e of authExamples) {
    const result = await send(exampleRequest(e), {});
    assert.equal(result.status, e.expected, e.title);
    assert.equal(result.headers["x-u-demo"], "local-simulation");
    assert.equal((result.body as {demo: boolean}).demo, true);
  }
});
test("pack preserves user edits and imports, collections and repeated installs round-trip", () => {
  const original = seed();
  const w = addAuthExamples(original);
  assert.equal(w.requests.length, original.requests.length + 15);
  assert.equal(w.collections?.[0].name, "Authorization");
  assert.equal(w.collections?.[0].folder, "Examples");
  assert.deepEqual(w.requests.slice(0, original.requests.length), original.requests);
  w.requests.at(-1)!.name = "Edited example";
  assert.deepEqual(addAuthExamples(w), w);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(w))));
  assert.ok(validateWorkspace(original));
  assert.equal(validateWorkspace({...w, collections: []}), false);
  assert.equal(validateWorkspace({...w, collections: [w.collections![0], w.collections![0]]}), false);
});
test("OAuth workflow passes token output into the protected API", async () => {
  const w = addAuthExamples(seed());
  const steps: Record<string, unknown> = {};
  for (const step of w.flows.at(-1)!.steps) {
    steps[step.id] = await executeStep(step, {...variables(w), steps}, new AbortController().signal);
    assert.equal((steps[step.id] as {status: number}).status, 200);
  }
});
test("demo rejects bad methods, Basic credentials, sessions, grants and scopes", () => {
  const input = { url: AUTH_DEMO_ORIGIN + "/basic", method: "GET", headers: {}, body: "" };
  assert.equal(authDemoResponse(input)?.status, 401);
  assert.equal(authDemoResponse({...input, method: "POST"})?.status, 405);
  assert.equal(authDemoResponse({...input, url: AUTH_DEMO_ORIGIN + "/session"})?.status, 401);
  assert.equal(authDemoResponse({...input, url: AUTH_DEMO_ORIGIN + "/unknown"})?.status, 404);
  assert.equal(authDemoResponse({...input, url: "https://example.com/basic"}), undefined);
  const example = exampleRequest(authExamples.find(e => e.key === "refresh")!);
  const token = {...example, headers: JSON.parse(example.headers)};
  assert.equal(authDemoResponse({...token, body: "grant_type=refresh_token&refresh_token=wrong"})?.status, 400);
  assert.equal(authDemoResponse({...token, body: "grant_type=password"})?.status, 400);
  assert.equal(authDemoResponse({...token, body: "grant_type=client_credentials&scope=admin"})?.status, 400);
  assert.equal(authDemoResponse({...token, headers: {...token.headers, Authorization: "wrong"}})?.status, 401);
});
test("demo header names are case insensitive and cancellation is respected", async () => {
  const e = exampleRequest(authExamples.find(e => e.key === "basic")!);
  const headers = JSON.parse(e.headers);
  e.headers = JSON.stringify({authorization: headers.Authorization});
  assert.equal((await send(e, {})).status, 200);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(send(e, {}, controller.signal), {name: "AbortError"});
});

test("legacy example collections move into Examples without changing requests or custom collections", () => {
  const w = addAuthExamples(seed());
  w.collections = [ {id: "examples-authorization", name: "Examples · Authorization"}, {id: "personal", name: "My API"} ];
  const organized = organizeAuthExamples(w);
  assert.deepEqual(organized.collections, [ {id: "examples-authorization", name: "Authorization", folder: "Examples"}, {id: "personal", name: "My API"} ]);
  assert.strictEqual(organized.requests, w.requests);
  assert.strictEqual(organizeAuthExamples(organized), organized);
  assert.equal(w.collections[0].folder, undefined);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(organized))));
});
test("folder metadata supports additional example collections and rejects invalid values", () => {
  const w = addAuthExamples(seed());
  w.collections!.push({id: "pagination", name: "Pagination", folder: "Examples"});
  assert.ok(validateWorkspace(w));
  assert.equal(validateWorkspace({...w, collections: [{id: "bad", name: "Bad", folder: 123}]}), false);
  assert.equal(validateWorkspace({...w, collections: [{id: "bad", name: "Bad", folder: " "}]}), false);
});
