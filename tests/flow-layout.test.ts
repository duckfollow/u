import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reorderFlowSteps} from '../src/flow-layout.ts';
import {seed,request,validSteps,type Flow,type Step} from '../src/model.ts';

test('dragging reorders a sequence without mutating steps or changing IDs and request content',()=>{
  const flow=seed().flows[0];const before=JSON.stringify(flow);
  const moved=reorderFlowSteps(flow,'login','projects',true);
  assert.deepEqual(moved.steps.map(s=>s.id),['projects','login','extract']);
  assert.strictEqual(moved.steps[1],flow.steps[0]);assert.ok(validSteps(moved.steps));assert.equal(JSON.stringify(flow),before);
  assert.deepEqual(reorderFlowSteps(moved,'login','projects').steps.map(s=>s.id),flow.steps.map(s=>s.id));
});
test('loop children reorder within their own sequence while cross-loop moves are rejected',()=>{
  const child=(id:string):Step=>({id,name:id,kind:'transform',request:request(),value:'{}'});
  const loop:Step={...child('loop'),kind:'loop',children:[child('first'),child('second')],loop:{maxIterations:10,errorMode:'stop'}};
  const flow:Flow={id:'flow',name:'Flow',steps:[loop,child('outside')]};
  const moved=reorderFlowSteps(flow,'second','first');
  assert.deepEqual(moved.steps[0].children!.map(s=>s.id),['second','first']);assert.ok(validSteps(moved.steps));
  assert.strictEqual(reorderFlowSteps(flow,'outside','first'),flow);
  assert.strictEqual(reorderFlowSteps(flow,'loop','first'),flow);
});
test('missing or identical drag targets leave the flow unchanged',()=>{
  const flow=seed().flows[0];assert.strictEqual(reorderFlowSteps(flow,'login','login'),flow);assert.strictEqual(reorderFlowSteps(flow,'missing','login'),flow);assert.strictEqual(reorderFlowSteps(flow,'login','missing'),flow);
});
