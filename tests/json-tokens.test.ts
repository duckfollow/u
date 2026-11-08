import {test} from "node:test";
import assert from "node:assert/strict";
import {jsonTokens} from "../src/json-tokens.ts";

test("JSON highlighting distinguishes keys and scalar values without altering text",()=>{
  const input='{"key":"value", "n":-1.25e+3,"ok":true,"off":false,"empty":null}';
  const tokens=jsonTokens(input);assert.equal(tokens.map(t=>t.text).join(""),input);
  assert.ok(tokens.some(t=>t.kind==="key"&&t.text==='"key"'));
  assert.ok(tokens.some(t=>t.kind==="string"&&t.text==='"value"'));
  assert.ok(tokens.some(t=>t.kind==="number"&&t.text==="-1.25e+3"));
  assert.equal(tokens.filter(t=>t.kind==="boolean").length,2);
  assert.equal(tokens.filter(t=>t.kind==="null").length,1);
});
test("escaped strings, templates, markup and incomplete JSON remain lossless",()=>{
  for(const input of ['{"a\\"b":"{{token}}","html":"<script>alert(1)</script>"}','{\n "name": "unfinished','<html>Plain response</html>','\n'])assert.equal(jsonTokens(input).map(t=>t.text).join(""),input);
  assert.deepEqual(jsonTokens('<html>Plain response</html>'),[{text:'<html>Plain response</html>'}]);
});
