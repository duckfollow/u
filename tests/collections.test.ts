import { test } from "node:test";
import assert from "node:assert/strict";
import { removeCollection, seed, validateWorkspace } from "../src/model.ts";
import { addAuthExamples, AUTH_EXAMPLES_COLLECTION } from "../src/auth-examples.ts";

test("deleting a collection keeps its requests in Unfiled by default and preserves other content", () => {
  const w = addAuthExamples(seed());
  const before = JSON.stringify(w);
  const result = removeCollection(w, AUTH_EXAMPLES_COLLECTION);
  assert.equal(result.collections?.length, 0);
  assert.equal(result.requests.length, w.requests.length);
  assert.ok(result.requests.every(r => !r.collectionId));
  assert.deepEqual(result.requests.slice(0, 2), w.requests.slice(0, 2));
  assert.strictEqual(result.flows, w.flows);
  assert.strictEqual(result.environments, w.environments);
  assert.strictEqual(result.history, w.history);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(result))));
  assert.equal(JSON.stringify(w), before);
});

test("explicitly deleting collection requests removes only members of that collection", () => {
  const w = addAuthExamples(seed());
  w.collections!.push({id: "other", name: "Other APIs"});
  w.requests[0].collectionId = "other";
  const result = removeCollection(w, AUTH_EXAMPLES_COLLECTION, true);
  assert.deepEqual(result.collections, [{id: "other", name: "Other APIs"}]);
  assert.deepEqual(result.requests, w.requests.slice(0, 2));
  assert.strictEqual(result.flows, w.flows);
  assert.ok(validateWorkspace(result));
});

test("empty and missing collections can be handled without removing unrelated requests", () => {
  const w = seed();
  assert.strictEqual(removeCollection(w, "missing", true), w);
  w.collections = [{id: "empty", name: "Empty"}];
  const result = removeCollection(w, "empty", true);
  assert.deepEqual(result.collections, []);
  assert.deepEqual(result.requests, w.requests);
  assert.ok(validateWorkspace(result));
  assert.strictEqual(removeCollection(w, "", true), w);
});

test("reinstalling examples restores unfiled examples without losing edits or deliberate moves", () => {
  const original = addAuthExamples(seed());
  original.collections!.push({id: "personal", name: "Personal"});
  const moved = original.requests.find(r => r.id === "auth-example-basic")!;
  moved.collectionId = "personal";
  const unfiled = removeCollection(original, AUTH_EXAMPLES_COLLECTION);
  unfiled.requests.find(r => r.id === "auth-example-public")!.name = "My edited example";
  const restored = addAuthExamples(unfiled);
  assert.equal(restored.requests.length, original.requests.length);
  assert.equal(restored.requests.find(r => r.id === "auth-example-public")!.collectionId, AUTH_EXAMPLES_COLLECTION);
  assert.equal(restored.requests.find(r => r.id === "auth-example-public")!.name, "My edited example");
  assert.equal(restored.requests.find(r => r.id === moved.id)!.collectionId, "personal");
  assert.equal(restored.requests[0].collectionId, undefined);
  assert.ok(validateWorkspace(restored));
});
