import {test} from "node:test";
import assert from "node:assert/strict";
import {exportDocumentationMarkdown} from "../src/documentation-markdown.ts";
import {addExamplePack} from "../src/example-packs.ts";
import {seed} from "../src/model.ts";

test("Markdown folder export contains child collections, requests and illustrative responses",()=>{
  const w=addExamplePack(addExamplePack(seed(),"http-basics"),"crud");
  const before=JSON.stringify(w);
  const {content,filename}=exportDocumentationMarkdown(w,{kind:"folder",name:"Examples"});
  assert.equal(filename,"Examples-api-documentation.md");
  assert.match(content,/2 collections · 14 requests/);
  assert.match(content,/## HTTP Basics/);assert.match(content,/## CRUD Workflow/);
  assert.match(content,/Response examples/);assert.match(content,/201 Created/);
  assert.match(content,/Illustrative demo response/);
  assert.equal(JSON.stringify(w),before);
});
test("Markdown export includes captured responses, raw templates and query values without resolving environments",()=>{
  const w=seed();
  w.requests=w.requests.slice(0,1);
  const r=w.requests[0];r.url="{{baseUrl}}/items?q=hello%20world&q=again";r.auth="{{token}}";
  w.environments.Local='{"baseUrl":"SECRET_ENVIRONMENT_VALUE"}';
  r.responseExamples=[{id:"saved",name:"Saved error",status:422,statusText:"Unprocessable Content",headers:{"content-type":"application/json"},body:{error:"name_required"}}];
  const {content}=exportDocumentationMarkdown(w,{kind:"collection",id:""});
  assert.match(content,/hello world/);assert.match(content,/again/);
  assert.match(content,/\{\{baseUrl\}\}/);assert.match(content,/\{\{token\}\}/);
  assert.match(content,/422 Unprocessable Content/);assert.match(content,/name_required/);
  assert.ok(!content.includes("SECRET_ENVIRONMENT_VALUE"));
});
test("Markdown export safely contains code fences, markup and filesystem characters",()=>{
  const w=seed();w.collections=[{id:"test",name:"../../ API <test>"}];w.requests=w.requests.slice(0,1);
  w.requests[0].collectionId="test";w.requests[0].name="[click](url)";w.requests[0].body="```\n# Body\n```";
  const {content,filename}=exportDocumentationMarkdown(w,{kind:"collection",id:"test"});
  assert.equal(filename,"API-test-api-documentation.md");
  assert.ok(content.includes("````\n```\n# Body\n```\n````"));
  assert.ok(content.includes("\\[click\\](url)"));
  const empty=exportDocumentationMarkdown(w,{kind:"folder",name:"Missing"});
  assert.match(empty.content,/No collections in this scope/);
});
