import type { Workspace } from "./model.ts";
export type CollectionNode = {id:string;name:string;folder?:string;parentId?:string};
export type LibraryDrag = {kind:"request"|"collection";id:string};
export function descendants(collections: CollectionNode[], id:string): Set<string> {
  const ids=new Set([id]); let changed=true;
  while(changed){changed=false;for(const c of collections)if(c.parentId&&ids.has(c.parentId)&&!ids.has(c.id)){ids.add(c.id);changed=true;}}
  return ids;
}
export function validCollectionTree(collections: CollectionNode[]):boolean {
  const map=new Map(collections.map(c=>[c.id,c]));
  for(const c of collections){const seen=new Set([c.id]);let parent=c.parentId;while(parent!==undefined){if(typeof parent!=="string"||!map.has(parent)||seen.has(parent))return false;seen.add(parent);parent=map.get(parent)!.parentId;}}
  return true;
}
export function organizeCollectionTree(workspace:Workspace):Workspace {
  const old=workspace.collections??[];
  if(!old.some(c=>c.folder))return workspace;
  const collections=old.map(c=>({...c}));
  const roots=new Map<string,string>();
  for(const c of collections.filter(c=>c.folder)){
    const folder=c.folder!;
    let root=roots.get(folder)??collections.find(n=>!n.parentId&&!n.folder&&n.name===folder)?.id;
    if(!root){let id=`folder-root-${encodeURIComponent(folder)}`;while(collections.some(n=>n.id===id))id+="-root";root=id;collections.push({id,name:folder});}
    roots.set(folder,root);
    if(!c.parentId)c.parentId=root;
    delete c.folder;
  }
  return {...workspace,collections};
}
export function collectionPath(collections:CollectionNode[],id:string):string {
  const parts:string[]=[];const seen=new Set<string>();let node=collections.find(c=>c.id===id);
  while(node&&!seen.has(node.id)){seen.add(node.id);parts.unshift(node.name);node=collections.find(c=>c.id===node!.parentId);}
  return parts.join(" / ");
}
/** Move before/after siblings, or into a collection; preserve all unrelated data. */
export function moveLibraryItem(workspace:Workspace,drag:LibraryDrag,parentId?:string,beforeId?:string):Workspace {
  const collections=workspace.collections??[];
  if(parentId!==undefined&&!collections.some(c=>c.id===parentId))return workspace;
  if(drag.kind==="request"){
    const item=workspace.requests.find(r=>r.id===drag.id);if(!item||beforeId===item.id)return workspace;
    const requests=workspace.requests.filter(r=>r.id!==item.id);const moved={...item,collectionId:parentId};
    const before=beforeId?requests.findIndex(r=>r.id===beforeId&&r.collectionId===parentId):-1;
    requests.splice(before<0?requests.length:before,0,moved);return {...workspace,requests};
  }
  const item=collections.find(c=>c.id===drag.id);if(!item||beforeId===item.id||parentId&&descendants(collections,item.id).has(parentId))return workspace;
  const remaining=collections.filter(c=>c.id!==item.id);const moved={...item,parentId};
  const before=beforeId?remaining.findIndex(c=>c.id===beforeId&&c.parentId===parentId):-1;
  remaining.splice(before<0?remaining.length:before,0,moved);return {...workspace,collections:remaining};
}
