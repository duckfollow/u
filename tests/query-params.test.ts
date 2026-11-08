import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseQueryParams,writeQueryParams} from '../src/query-params.ts';
import {seed,validateWorkspace,send} from '../src/model.ts';

test('query parameters preserve repeated keys and decode encoded values',()=>{
  assert.deepEqual(parseQueryParams('https://example.com/items?tag=a&tag=b&q=hello+world&empty=#section'),[{key:'tag',value:'a'},{key:'tag',value:'b'},{key:'q',value:'hello world'},{key:'empty',value:''}]);
});
test('writing parameters preserves base, fragment and template interpolation while encoding literal characters',()=>{
  assert.equal(writeQueryParams('{{baseUrl}}/items?old=1#results',[{key:'search',value:'{{query}} & ภาษาไทย'},{key:'page',value:'2'}]),'{{baseUrl}}/items?search={{query}}%20%26%20%E0%B8%A0%E0%B8%B2%E0%B8%A9%E0%B8%B2%E0%B9%84%E0%B8%97%E0%B8%A2&page=2#results');
  assert.equal(writeQueryParams('https://example.com/?a=1#x',[]),'https://example.com/#x');
});
test('disabled parameters round-trip but are omitted from sent URLs',async()=>{
  const w=seed();const r=w.requests[0];r.url=writeQueryParams('https://examples.u.local/echo',[{key:'q',value:'{{query}}'},{key:'tag',value:'a'},{key:'tag',value:'b'}]);r.method='GET';r.body='';r.disabledParams=[{key:'secret',value:'disabled'}];
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(w))));
  const result=await send(r,{query:'hello'});const body=result.body as {query:Record<string,string>};assert.equal(body.query.q,'hello');assert.equal(body.query.secret,undefined);
  r.disabledParams=[{key:'bad',value:123}] as never;assert.equal(validateWorkspace(w),false);
});
