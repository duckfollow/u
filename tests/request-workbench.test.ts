import {test} from "node:test";
import assert from "node:assert/strict";
import {seed,send,validateWorkspace} from "../src/model.ts";

test("disabled header values survive exports while only enabled headers are sent",async()=>{
  const w=seed();const spec=w.requests[0];spec.url="https://examples.u.local/echo";spec.method="GET";spec.body="";
  spec.headers='{"X-Enabled":"yes"}';spec.disabledHeaders={"X-Disabled":"kept locally"};
  const exported=JSON.parse(JSON.stringify(w));assert.ok(validateWorkspace(exported));assert.deepEqual(exported.requests[0].disabledHeaders,spec.disabledHeaders);
  const result=await send(spec,{});const body=result.body as {headers:Record<string,string>};
  assert.equal(body.headers["x-enabled"],"yes");assert.equal(body.headers["x-disabled"],undefined);
});
test("workspace validation rejects malformed disabled header values",()=>{
  const w=seed();w.requests[0].disabledHeaders={token:123} as never;assert.equal(validateWorkspace(w),false);
  w.requests[0].disabledHeaders=[] as never;assert.equal(validateWorkspace(w),false);
});
