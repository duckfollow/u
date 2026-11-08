import {test} from "node:test";
import assert from "node:assert/strict";
import {seed,validateWorkspace,removeCollection} from "../src/model.ts";
import {addExamplePack} from "../src/example-packs.ts";
import {organizeCollectionTree,moveLibraryItem,collectionPath,validCollectionTree} from "../src/collection-tree.ts";
import {documentationGroups} from "../src/collection-docs.ts";

test("legacy folder grouping becomes a collection tree without changing requests or losing edits",()=>{
  const old=addExamplePack(addExamplePack(seed(),"authorization"),"crud");
  old.requests[2].name="Edited";
  const w=organizeCollectionTree(old);
  assert.equal(w.collections?.length,3);
  assert.strictEqual(w.requests,old.requests);
  const root=w.collections!.find(c=>c.name==="Examples")!;
  assert.ok(root);
  assert.equal(w.collections!.find(c=>c.name==="Authorization")!.parentId,root.id);
  assert.equal(collectionPath(w.collections!,"examples-authorization"),"Examples / Authorization");
  assert.ok(validateWorkspace(w));
  assert.strictEqual(organizeCollectionTree(w),w);
  assert.ok(old.collections!.every(c=>c.folder==="Examples"));
});
function fixture(){
  const w=seed();w.collections=[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C",parentId:"a"}];
  w.requests[0].collectionId="a";w.requests[1].collectionId="c";return w;
}
test("requests can reorder, move into folders and return to Unfiled",()=>{
  let w=fixture();const ids=w.requests.map(r=>r.id);
  w=moveLibraryItem(w,{kind:"request",id:ids[0]},"c",ids[1]);
  assert.equal(w.requests[0].collectionId,"c");assert.equal(w.requests[0].id,ids[0]);
  w=moveLibraryItem(w,{kind:"request",id:ids[1]},"c",ids[0]);
  assert.equal(w.requests[0].id,ids[1]);
  w=moveLibraryItem(w,{kind:"request",id:ids[0]});
  assert.equal(w.requests.find(r=>r.id===ids[0])!.collectionId,undefined);
  assert.ok(validateWorkspace(JSON.parse(JSON.stringify(w))));
});
test("folders and collections reorder or move, while cycles and missing destinations are rejected",()=>{
  let w=fixture();
  w=moveLibraryItem(w,{kind:"collection",id:"b"},undefined,"a");assert.equal(w.collections![0].id,"b");
  w=moveLibraryItem(w,{kind:"collection",id:"c"},"b");assert.equal(w.collections!.find(c=>c.id==="c")!.parentId,"b");
  assert.strictEqual(moveLibraryItem(w,{kind:"collection",id:"b"},"c"),w);
  assert.strictEqual(moveLibraryItem(w,{kind:"collection",id:"b"},"b"),w);
  assert.strictEqual(moveLibraryItem(w,{kind:"request",id:w.requests[0].id},"missing"),w);
  assert.equal(validCollectionTree([{id:"a",name:"A",parentId:"b"},{id:"b",name:"B",parentId:"a"}]),false);
  assert.ok(validateWorkspace(w));
});
test("documentation and deletion include all nested folders and preserve unrelated requests",()=>{
  const w=fixture();
  assert.equal(documentationGroups(w,{kind:"collection",id:"a"}).reduce((sum,g)=>sum+g.requests.length,0),2);
  const kept=removeCollection(w,"a");assert.deepEqual(kept.collections,[{id:"b",name:"B"}]);assert.ok(kept.requests.every(r=>!r.collectionId));assert.ok(validateWorkspace(kept));
  const removed=removeCollection(w,"a",true);assert.equal(removed.requests.length,0);assert.ok(validateWorkspace(removed));
  assert.equal(w.collections!.length,3);
});
