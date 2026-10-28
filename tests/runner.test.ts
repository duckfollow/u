import { test } from "node:test";
import assert from "node:assert/strict";
import { FlowRunner, type LoopOutput } from "../src/runner.ts";
import {
  request,
  seed,
  validateWorkspace,
  type Step,
  type Flow,
} from "../src/model.ts";
const signal = () => new AbortController().signal;
const transform = (id: string, value: string): Step => ({
  id,
  name: id,
  kind: "transform",
  value,
  request: request(),
});
const loop = (
  value = '[{"id":1},{"id":2}]',
  children = [
    transform("item", "{{loop.item}}"),
    transform("index", "{{loop.index}}"),
  ],
): Step => ({
  id: "each",
  name: "For each",
  kind: "loop",
  value,
  request: request(),
  children,
  loop: { maxIterations: 50, errorMode: "stop" },
});
const flow = (...steps: Step[]): Flow => ({ id: "flow", name: "Test", steps });
async function finish(r: FlowRunner) {
  let count = 0;
  while (!r.done) {
    assert.ok(++count < 1000);
    await r.tick(signal());
  }
  return r.outputs.each as LoopOutput;
}
test("Next step advances through each child and keeps each iteration isolated", async () => {
  const r = new FlowRunner(
    flow(loop(), transform("after", "{{steps.each.iterations.1.steps.item}}")),
    {},
  );
  await r.tick(signal());
  assert.equal(r.next, 0);
  assert.equal(r.expectedChild, "index");
  assert.deepEqual((r.outputs.each as LoopOutput).current?.steps.item, {
    id: 1,
  });
  await r.tick(signal());
  assert.equal(r.progress.each.completed, 1);
  assert.equal(r.expectedChild, "item");
  await r.tick(signal());
  assert.equal((r.outputs.each as LoopOutput).current?.steps.index, undefined);
  const result = await finish(r);
  assert.deepEqual(
    result.iterations.map((i) => i.steps.index),
    [0, 1],
  );
  assert.deepEqual(r.outputs.after, { id: 2 });
  assert.equal(r.states.each, "success");
});
test("loop source can refer to a previous step", async () => {
  const r = new FlowRunner(
    flow(
      transform("list", "[10,20]"),
      loop("{{steps.list}}", [transform("copy", "{{loop.item}}")]),
    ),
    {},
  );
  const result = await finish(r);
  assert.deepEqual(
    result.iterations.map((i) => i.steps.copy),
    [10, 20],
  );
});
test("empty input skips all iterations and continues downstream", async () => {
  const r = new FlowRunner(flow(loop("[]"), transform("after", "true")), {});
  const result = await finish(r);
  assert.equal(result.completed, 0);
  assert.deepEqual(result.iterations, []);
  assert.equal(r.outputs.after, true);
});
test("rejects non-Arrays and limits before any child executes", async () => {
  for (const s of [
    loop("{}"),
    {
      ...loop("[1,2]"),
      loop: { maxIterations: 1, errorMode: "stop" as const },
    },
  ]) {
    const r = new FlowRunner(flow(s), {});
    await assert.rejects(r.tick(signal()), /Array|limit/);
    assert.equal(r.states.each, "error");
    assert.equal(r.states.item, undefined);
  }
});
test("stop policy preserves the failing item without running downstream", async () => {
  const r = new FlowRunner(
    flow(
      loop("[1,2]", [transform("fail", "{{missing}}")]),
      transform("after", "true"),
    ),
    {},
  );
  await assert.rejects(r.tick(signal()), /not found/);
  const result = r.outputs.each as LoopOutput;
  assert.equal(result.iterations[0].status, "error");
  assert.equal(result.completed, 0);
  assert.equal(r.outputs.after, undefined);
  assert.equal(r.next, 0);
});
test("continue policy records failures and skips remaining children per item", async () => {
  const s = loop("[1,2]", [
    transform("fail", "{{missing}}"),
    transform("never", "true"),
  ]);
  s.loop!.errorMode = "continue";
  const r = new FlowRunner(flow(s, transform("after", "true")), {});
  const result = await finish(r);
  assert.equal(result.completed, 2);
  assert.equal(result.iterations.length, 2);
  assert.ok(
    result.iterations.every(
      (i) => i.status === "error" && i.steps.never === undefined,
    ),
  );
  assert.equal(r.states.each, "warning");
  assert.equal(r.outputs.after, true);
});
test("a false condition skips the rest of that item and continues next item", async () => {
  const check = {
    ...transform("check", "{{loop.item}}"),
    kind: "condition" as const,
  };
  const r = new FlowRunner(
    flow(loop("[false,true]", [check, transform("copy", "{{loop.index}}")])),
    {},
  );
  const result = await finish(r);
  assert.equal(result.iterations[0].status, "skipped");
  assert.equal(result.iterations[0].steps.copy, undefined);
  assert.equal(result.iterations[1].steps.copy, 1);
});
test("cancelling a delay stops even with continue policy", async () => {
  const s = loop("[1,2]", [{ ...transform("wait", "30000"), kind: "delay" }]);
  s.loop!.errorMode = "continue";
  const r = new FlowRunner(flow(s), {}),
    controller = new AbortController();
  const pending = r.tick(controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(r.states.each, "stopped");
  assert.equal((r.outputs.each as LoopOutput).iterations.length, 1);
});
test("imports round-trip loops and reject nested loops, duplicate IDs, or unsafe limits", () => {
  const w = seed();
  w.flows = [flow(loop())];
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(w))));
  w.flows = [flow(loop("[]", [loop()]))];
  assert.equal(validateWorkspace(w), false);
  w.flows = [flow(loop(), transform("item", "true"))];
  assert.equal(validateWorkspace(w), false);
  w.flows = [
    flow({ ...loop(), loop: { maxIterations: 101, errorMode: "stop" } }),
  ];
  assert.equal(validateWorkspace(w), false);
});
test("HTTP errors inside a loop obey the error policy and retain earlier item output", async () => {
  const s = loop("[1,2]", [{ ...transform("fetch", ""), kind: "request" }]);
  s.loop!.errorMode = "continue";
  const r = new FlowRunner(flow(s), {}, 0, {}, async (_request, context) => ({
    status:
      (context as { loop: { index: number } }).loop.index === 0 ? 200 : 500,
    statusText: "Test",
    body: {},
    headers: {},
    duration: 1,
    size: 1,
  }));
  const result = await finish(r);
  assert.deepEqual(
    result.iterations.map((i) => i.status),
    ["success", "error"],
  );
  assert.equal(r.states.each, "warning");
});
test("current loop output is not exposed to its own children", async () => {
  const r = new FlowRunner(
    flow(loop("[1]", [transform("self", "{{steps.each}}")])),
    {},
  );
  await assert.rejects(r.tick(signal()), /not found/);
  assert.doesNotThrow(() => JSON.stringify(r.snapshot()));
});
test("running a loop again clears old downstream results", async () => {
  const f = flow(
    loop("[1]", [transform("copy", "{{loop.item}}")]),
    transform("after", "{{steps.each.iterations.0.steps.copy}}"),
  );
  const first = new FlowRunner(f, {});
  await finish(first);
  const rerun = new FlowRunner(f, {}, 0, first.outputs);
  assert.equal(rerun.outputs.after, undefined);
  assert.equal(rerun.outputs.each, undefined);
  await rerun.tick(signal());
  assert.equal(rerun.outputs.after, undefined);
});
test("repeat process executes every HTTP and transform child in every round", async () => {
  const s = loop("3", [
    { ...transform("http", ""), kind: "request" },
    transform("round", "{{loop.number}}"),
  ]);
  s.loop!.mode = "repeat";
  let calls = 0;
  const r = new FlowRunner(flow(s), {}, 0, {}, async () => {
    calls++;
    return {
      status: 200,
      statusText: "OK",
      body: { call: calls },
      headers: {},
      size: 1,
      duration: 1,
    };
  });
  const result = await finish(r);
  assert.equal(calls, 3);
  assert.deepEqual(
    result.iterations.map((i) => i.steps.round),
    [1, 2, 3],
  );
  assert.equal(result.completed, 3);
});
test("repeat supports environment count, zero rounds, and rejects invalid counts before requests", async () => {
  const s = loop("{{rounds}}");
  s.loop!.mode = "repeat";
  assert.equal(
    (await finish(new FlowRunner(flow(s), { rounds: 2 }))).completed,
    2,
  );
  assert.equal(
    (await finish(new FlowRunner(flow({ ...s, value: "0" }), {}))).completed,
    0,
  );
  for (const count of ["-1", "1.5", '"3"', "101"])
    await assert.rejects(
      new FlowRunner(flow({ ...s, value: count }), {}).tick(signal()),
      /integer|limit/,
    );
});
