import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  interpolate,
  resolveValue,
  executeStep,
  validateWorkspace,
  variables,
} from "../src/model.ts";
test("resolves environment values and preserves typed step outputs", () => {
  const context = {
    baseUrl: "http://localhost",
    steps: { login: { body: { token: "abc", projects: [1, 2] } } },
  };
  assert.equal(
    interpolate(
      "{{baseUrl}}/projects?token={{steps.login.body.token}}",
      context,
    ),
    "http://localhost/projects?token=abc",
  );
  assert.deepEqual(
    resolveValue("{{steps.login.body.projects}}", context),
    [1, 2],
  );
  assert.throws(() => interpolate("{{missing}}", context), /not found/);
  assert.throws(() => interpolate("{{__proto__}}", context), /Invalid/);
});
test("workspace validation rejects corrupt imports", () => {
  assert.equal(validateWorkspace(seed()), true);
  const bad = seed();
  bad.flows[0].steps[0].kind = "script" as never;
  assert.equal(validateWorkspace(bad), false);
  assert.equal(validateWorkspace({ version: 1 }), false);
});
test("runs login, authenticated request and data transform sequentially", async () => {
  const w = seed(),
    outputs: Record<string, unknown> = {};
  for (const step of w.flows[0].steps) {
    outputs[step.id] = await executeStep(
      step,
      { ...variables(w), steps: outputs },
      new AbortController().signal,
      async (spec, context) => {
        if (step.id === "projects")
          assert.equal(interpolate(spec.auth, context), "demo-token");
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          body:
            step.id === "login"
              ? { token: "demo-token" }
              : { projects: [{ id: 1 }] },
          duration: 1,
          size: 1,
        };
      },
    );
  }
  assert.deepEqual(outputs.extract, [{ id: 1 }]);
});
test("HTTP errors stop a request step and conditions must be boolean", async () => {
  const step = seed().flows[0].steps[0];
  await assert.rejects(
    executeStep(step, {}, new AbortController().signal, async () => ({
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      body: {},
      duration: 1,
      size: 1,
    })),
    /401/,
  );
  await assert.rejects(
    executeStep(
      { ...step, kind: "condition", value: '"false"' },
      {},
      new AbortController().signal,
    ),
    /true or false/,
  );
  assert.equal(
    await executeStep(
      { ...step, kind: "condition", value: "false" },
      {},
      new AbortController().signal,
    ),
    false,
  );
});
test("delay can be cancelled and rejects invalid durations", async () => {
  const step = {
    ...seed().flows[0].steps[0],
    kind: "delay" as const,
    value: "10000",
  };
  const controller = new AbortController();
  const pending = executeStep(step, {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(
    executeStep({ ...step, value: "-1" }, {}, new AbortController().signal),
    /between/,
  );
});
