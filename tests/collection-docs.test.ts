import {test} from "node:test";
import assert from "node:assert/strict";
import {documentationGroups, requestVariables} from "../src/collection-docs.ts";
import {seed} from "../src/model.ts";
import {addExamplePack} from "../src/example-packs.ts";

test("folder docs include all child collections and requests and leave the workspace unchanged", () => {
  let w = addExamplePack(seed(), "http-basics");
  w = addExamplePack(w, "crud");
  w.collections!.push({id:"personal",name:"Personal"});
  const before = JSON.stringify(w);
  const groups = documentationGroups(w,{kind:"folder",name:"Examples"});
  assert.equal(groups.length,2);
  assert.equal(groups.reduce((n,g)=>n+g.requests.length,0),14);
  assert.ok(groups.every(g=>g.requests.every(r=>r.collectionId===g.id)));
  assert.equal(JSON.stringify(w),before);
});
test("collection docs support unfiled, empty and missing collections", () => {
  const w = seed();
  w.collections = [{id:"empty",name:"Empty"}];
  assert.equal(documentationGroups(w,{kind:"collection",id:""})[0].requests.length,2);
  assert.equal(documentationGroups(w,{kind:"collection",id:"empty"})[0].requests.length,0);
  assert.deepEqual(documentationGroups(w,{kind:"collection",id:"missing"}),[]);
  assert.deepEqual(documentationGroups(w,{kind:"folder",name:"missing"}),[]);
});
test("documentation lists template variables across request fields without resolving values", () => {
  const r = seed().requests[0];
  r.url="{{ baseUrl }}/items?id={{steps.create.body.id}}";
  r.headers='{"X-Key":"{{apiKey}}","Other":"{{baseUrl}}"}';
  r.body='{"name":"{{name}}"}'; r.auth="{{token}}";
  assert.deepEqual(requestVariables(r),["baseUrl","steps.create.body.id","apiKey","name","token"]);
});
