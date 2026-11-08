import type {Flow} from "./model.ts";
export function reorderFlowSteps(flow:Flow,sourceId:string,targetId:string,after=false):Flow {
  if(sourceId===targetId)return flow;
  function parent(id:string){return flow.steps.some(s=>s.id===id)?null:flow.steps.find(s=>s.children?.some(c=>c.id===id))?.id;}
  const sourceParent=parent(sourceId);if(sourceParent===undefined||sourceParent!==parent(targetId))return flow;
  const original=sourceParent===null?flow.steps:flow.steps.find(s=>s.id===sourceParent)!.children!;
  const source=original.find(s=>s.id===sourceId)!;const steps=original.filter(s=>s.id!==sourceId);const index=steps.findIndex(s=>s.id===targetId);if(index<0)return flow;
  steps.splice(index+(after?1:0),0,source);
  return {...flow,steps:sourceParent===null?steps:flow.steps.map(s=>s.id===sourceParent?{...s,children:steps}:s)};
}
