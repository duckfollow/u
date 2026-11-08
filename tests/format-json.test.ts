import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatJson,jsonFormatError} from '../src/format-json.ts';

test('formats nested JSON using two spaces and leaves scalar values unchanged',()=>{
  const input='{"a":[1,true,null,{"b":"{{token}}"}],"empty":{}}';
  const output=formatJson(input);assert.deepEqual(JSON.parse(output),JSON.parse(input));assert.match(output,/\n  "a": \[/);assert.match(output,/"empty": \{\}/);assert.equal(formatJson(output),output);
});
test('formatting preserves large numbers, duplicate keys and string escape spelling',()=>{
  const input='{"id":900719925474099312345,"n":1.00e+100,"a":1,"a":2,"str":"\\u0061"}';
  const output=formatJson(input);assert.match(output,/900719925474099312345/);assert.match(output,/1\.00e\+100/);assert.equal((output.match(/"a":/g)??[]).length,2);assert.ok(output.includes('"\\u0061"'));
});
test('invalid JSON is rejected and error messages identify available location',()=>{
  for(const input of ['{"a":}','plain text','a=1',''])assert.throws(()=>formatJson(input));
  assert.match(jsonFormatError('{\n"a":}',new SyntaxError('Unexpected token at position 6')),/line 2, column 5/);
});
