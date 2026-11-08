import {test} from "node:test";
import assert from "node:assert/strict";
import {addExamplePack, examplePacks} from "../src/example-packs.ts";
import {EXAMPLE_DEMO_ORIGIN, exampleDemoResponse, resetExampleDemoData} from "../src/example-demo.ts";
import {seed, send, variables, validateWorkspace, executeStep} from "../src/model.ts";

const signal = () => new AbortController().signal;
test("HTTP basics echo query, headers and JSON; HEAD and OPTIONS return no body", async () => {
  const pack = examplePacks.find(p => p.id === "http-basics")!;
  for (const spec of pack.requests) {
    const result = await send(spec, {});
    assert.equal(result.status, spec.method === "OPTIONS" ? 204 : 200);
    if (["HEAD", "OPTIONS"].includes(spec.method)) { assert.equal(result.body, ""); assert.equal(result.size, 0); }
    else {
      const body = result.body as {method:string; query:Record<string,string>; headers:Record<string,string>; body:unknown};
      assert.equal(body.method, spec.method);
      if (spec.id.endsWith("-get")) assert.equal(body.query.search, "hello world");
      if (spec.id.endsWith("-headers")) assert.equal(body.headers["x-request-id"], "u-example-001");
      if (spec.body) assert.deepEqual(body.body, JSON.parse(spec.body));
    }
    if (spec.method === "OPTIONS") assert.match(result.headers.allow, /PATCH/);
  }
});
test("example environments remain separate and workflows reuse actual response values", async () => {
  const original = seed();
  const w = addExamplePack(original, "variables");
  for (const label of ["Local", "Development"]) {
    w.environment = `Examples · ${label}`;
    const context = variables(w);
    const steps: Record<string, unknown> = {};
    for (const step of examplePacks.find(p => p.id === "variables")!.flows[0].steps) steps[step.id] = await executeStep(step, {...context, steps}, signal());
    const reused = steps.reuse as {body:{body:{name:string; environment:string}}};
    assert.equal(reused.body.body.name, label === "Local" ? "Tony" : "Pepper");
    assert.equal(reused.body.body.environment, label.toLowerCase());
    const bodyRequest = await send(examplePacks.find(p => p.id === "variables")!.requests[1], context);
    assert.equal(bodyRequest.status, 200);
  }
  for (const [key,value] of Object.entries(original.environments)) assert.equal(w.environments[key],value);
});
test("CRUD workflow passes created IDs, updates only that project, deletes it and runs repeatedly", async () => {
  resetExampleDemoData();
  const flow = examplePacks.find(p => p.id === "crud")!.flows[0];
  const ids: number[] = [];
  for (let i=0;i<2;i++) {
    const steps: Record<string, unknown> = {};
    for (const step of flow.steps) steps[step.id] = await executeStep(step, {steps}, signal());
    const created = steps.create as {status:number; body:{id:number;name:string}};
    const read = steps.read as {body:{id:number;name:string}};
    const updated = steps.update as {body:{id:number;status:string}};
    assert.equal(created.status,201);
    assert.equal(read.body.id,created.body.id);
    assert.equal(updated.body.id,created.body.id);
    assert.equal(updated.body.status,"archived");
    assert.equal((steps.delete as {status:number}).status,204);
    ids.push(created.body.id);
  }
  assert.notEqual(ids[0],ids[1]);
  const list = exampleDemoResponse({url:EXAMPLE_DEMO_ORIGIN+"/projects",method:"GET",headers:{},body:""})!;
  assert.equal((list.body as {projects:unknown[]}).projects.length,1);
});
test("CRUD manual requests and reset restore demo data without changing saved workspace", async () => {
  resetExampleDemoData();
  const w = addExamplePack(seed(),"crud");
  const before = JSON.stringify(w);
  const pack = examplePacks.find(p => p.id === "crud")!;
  const expected = [200,201,200,200,200,204];
  for (const [i,r] of pack.requests.entries()) assert.equal((await send(r,{})).status,expected[i]);
  assert.equal((await send(pack.requests[2],{})).status,404);
  resetExampleDemoData();
  const restored = await send(pack.requests[2],{});
  assert.equal(restored.status,200);
  assert.equal((restored.body as {name:string}).name,"Demo project");
  assert.equal(JSON.stringify(w),before);
});
test("adding packs is repeatable, preserves user edits and moves, and round-trips through exports", () => {
  let w = seed();
  for (const pack of examplePacks) {
    w = addExamplePack(w,pack.id);
    assert.ok(validateWorkspace(w));
    assert.deepEqual(addExamplePack(w,pack.id),w);
  }
  const sample = w.requests.find(r => r.id === "example-crud-create")!;
  sample.name = "My edited example";
  sample.collectionId = "examples-http-basics";
  w.environments["Examples · Local"] = '{"baseUrl":"https://custom.example"}';
  const added = addExamplePack(addExamplePack(w,"crud"),"variables");
  assert.deepEqual(added.requests,w.requests);
  assert.deepEqual(added.environments,w.environments);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(added))));
});
test("demo rejects malformed input, wrong methods and unknown routes and respects cancellation", async () => {
  resetExampleDemoData();
  const req = {url:EXAMPLE_DEMO_ORIGIN+"/projects",method:"POST",headers:{"Content-Type":"application/json"},body:"{"};
  assert.equal(exampleDemoResponse(req)?.status,400);
  assert.equal(exampleDemoResponse({...req,body:'{"name":""}'})?.status,422);
  assert.equal(exampleDemoResponse({...req,body:'{"name":"valid","status":"active","id":5}'})?.status,422);
  assert.equal(exampleDemoResponse({...req,headers:{}})?.status,415);
  assert.equal(exampleDemoResponse({...req,method:"DELETE"})?.status,405);
  assert.equal(exampleDemoResponse({...req,url:EXAMPLE_DEMO_ORIGIN+"/missing"})?.status,404);
  assert.equal(exampleDemoResponse({...req,url:"https://example.com/projects"}),undefined);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(send(examplePacks[1].requests[0],{},abort.signal),{name:"AbortError"});
});
