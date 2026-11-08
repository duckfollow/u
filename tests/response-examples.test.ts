import {test} from "node:test";
import assert from "node:assert/strict";
import {captureResponse,builtInResponseExamples,responseExamples} from "../src/response-examples.ts";
import {seed,validateWorkspace,type Result} from "../src/model.ts";
import {authExamples} from "../src/auth-examples.ts";
import {examplePacks} from "../src/example-packs.ts";
import {exampleDemoResponse,EXAMPLE_DEMO_ORIGIN,resetExampleDemoData} from "../src/example-demo.ts";

test("all example requests have illustrative responses and auth errors retain expected statuses",()=>{
  for(const e of authExamples) assert.equal(builtInResponseExamples(`auth-example-${e.key}`)[0].status,e.expected);
  for(const r of examplePacks.flatMap(p=>p.requests)) assert.equal(builtInResponseExamples(r.id).length,1,r.name);
  assert.deepEqual(builtInResponseExamples("custom-request"),[]);
});
test("viewing response examples does not mutate the CRUD dataset",()=>{
  resetExampleDemoData();
  const input={url:EXAMPLE_DEMO_ORIGIN+"/projects",method:"GET",headers:{},body:""};
  const before=exampleDemoResponse(input);
  for(const r of examplePacks.flatMap(p=>p.requests)) builtInResponseExamples(r.id);
  assert.deepEqual(exampleDemoResponse(input),before);
});
test("captured response examples are independent snapshots and export/import preserves them",()=>{
  const result: Result={status:200,statusText:"OK",headers:{"content-type":"application/json"},body:{items:[1]},duration:12,size:13};
  const captured=captureResponse(result,"saved-1");
  result.headers.test="changed";(result.body as {items:number[]}).items.push(2);
  assert.deepEqual(captured.body,{items:[1]});assert.equal(captured.headers.test,undefined);
  const w=seed();w.requests[0].responseExamples=[captured];
  assert.equal(responseExamples(w.requests[0]).length,1);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(w))));
  w.requests[0].responseExamples=[{...captured,status:999}];
  assert.equal(validateWorkspace(w),false);
  w.requests[0].responseExamples=[{...captured,headers:[] as never}];
  assert.equal(validateWorkspace(w),false);
});
