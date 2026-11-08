import CollectionActionsMenu, { type CollectionMenuTarget } from "./CollectionActionsMenu";
import type { DocumentationScope } from "./collection-docs";
import { useEffect, useState, type ReactNode, type DragEvent, type KeyboardEvent } from "react";
import { ChevronRight, FolderOpen, MoreHorizontal, Plus, X, Check, GripVertical } from "lucide-react";
import type { Workspace, RequestSpec } from "./model";
import { descendants, type LibraryDrag } from "./collection-tree";

export default function RequestCollections({workspace,query,busy,renderRequest,onCreate,onNewRequest,onDelete,onViewDocumentation,creationFolder,onStartCreate,onCancelCreate,onMove,onRename}: {
  workspace:Workspace;query:string;busy:boolean;renderRequest:(request:RequestSpec)=>ReactNode;
  creationFolder:string|null;onStartCreate:(parentId:string)=>void;onCancelCreate:()=>void;
  onViewDocumentation:(scope:DocumentationScope)=>void;onDelete:(id:string)=>void;
  onCreate:(name:string,parentId?:string)=>void;onNewRequest:(parentId?:string)=>void;
  onRename:(id:string,name:string)=>void;
  onMove:(drag:LibraryDrag,parentId?:string,beforeId?:string)=>void;
}) {
  const [menuTarget,setMenuTarget]=useState<CollectionMenuTarget|null>(null);
  const [renaming,setRenaming]=useState<{id:string;name:string}|null>(null);
  const [name,setName]=useState("");
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [drag,setDrag]=useState<LibraryDrag|null>(null);
  const [over,setOver]=useState("");
  const collections=workspace.collections??[];
  const search=query.trim().toLowerCase();
  useEffect(()=>{if(creationFolder!==null)setName("");},[creationFolder]);
  function toggle(id:string){setCollapsed(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});}
  function start(event:DragEvent,item:LibraryDrag){if(busy){event.preventDefault();return;}event.stopPropagation();setDrag(item);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-u-library",JSON.stringify(item));}
  function keyboardMove(event: KeyboardEvent, item: LibraryDrag, parentId?: string) {
    if (!event.altKey || busy || !["ArrowUp","ArrowDown","ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") {
      if (parentId) onMove(item, collections.find(c => c.id === parentId)?.parentId);
      return;
    }
    const siblings = item.kind === "collection" ? collections.filter(c => c.parentId === parentId) : workspace.requests.filter(r => r.collectionId === parentId);
    const index = siblings.findIndex(r => r.id === item.id);
    if (event.key === "ArrowUp" && index > 0) onMove(item, parentId, siblings[index - 1].id);
    if (event.key === "ArrowDown" && index >= 0 && index < siblings.length - 1) onMove(item, parentId, siblings[index + 2]?.id);
  }
  function dropProps(key:string,parentId?:string,beforeId?:string){return {
    onDragOver:(event:DragEvent)=>{if(!drag||busy)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";setOver(key);},
    onDrop:(event:DragEvent)=>{if(!drag||busy)return;event.preventDefault();event.stopPropagation();onMove(drag,parentId,beforeId);if(parentId)setCollapsed(prev=>{const next=new Set(prev);next.delete(parentId);return next;});setDrag(null);setOver("");},
  };}
  function zone(key:string,parentId?:string,beforeId?:string){return <div key={key} className={`library-drop-zone ${over===key?"is-over":""}`} {...dropProps(key,parentId,beforeId)}/>;}
  function node(id:string,label:string,path:string):ReactNode {
    const collection=collections.find(c=>c.id===id);
    const children=collections.filter(c=>c.parentId===id);
    const allRequests=workspace.requests.filter(r=>(r.collectionId??"")===id);
    const match=!search||`${path} ${label}`.toLowerCase().includes(search);
    const requests=allRequests.filter(r=>match||`${r.name} ${r.method} ${r.url}`.toLowerCase().includes(search));
    const childNodes=children.map(c=>node(c.id,c.name,`${path} ${label}`)).filter(Boolean);
    if(search&&!match&&!requests.length&&!childNodes.length)return null;
    const open=!!search||!collapsed.has(id);
    const parent=collection?.parentId;
    const total=workspace.requests.filter(r=>id ? descendants(collections,id).has(r.collectionId??"") : !r.collectionId).length;
    return <section key={id} className="request-collection">
      {id&&zone(`before-node:${id}`,parent,id)}
      <div className={`collection-heading ${!parent?"collection-folder-heading":""} ${over===`into:${id}`?"library-drop-inside":""}`} {...dropProps(`into:${id}`,id||undefined)} onContextMenu={event=>{
        event.preventDefault();event.stopPropagation();
        const trigger=event.currentTarget.querySelector<HTMLButtonElement>('.collection-more-button')!;
        setMenuTarget({id,name:label,x:event.clientX,y:event.clientY,trigger});
      }} onKeyDown={event=>{
        if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){
          event.preventDefault();event.stopPropagation();const trigger=event.currentTarget.querySelector<HTMLButtonElement>('.collection-more-button')!;const rect=trigger.getBoundingClientRect();setMenuTarget({id,name:label,x:rect.right-220,y:rect.bottom+4,trigger});
        }
      }}>
        {id&&<span className="library-drag-handle" draggable={!busy} role="button" tabIndex={0} aria-label={`Drag ${label} to move`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft" onKeyDown={event=>keyboardMove(event,{kind:"collection",id},parent)} title="Drag to reorder or move into another folder" onDragStart={event=>start(event,{kind:"collection",id})} onDragEnd={()=>{setDrag(null);setOver("");}}><GripVertical size={12}/></span>}
        {renaming?.id===id ? <form className="collection-rename-form" onSubmit={event=>{
          event.preventDefault();if(busy||!renaming.name.trim())return;
          onRename(id,renaming.name.trim());setRenaming(null);
        }} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setRenaming(null);}}}>
          <input autoFocus aria-label={`Rename ${label}`} value={renaming.name} maxLength={80} disabled={busy} onFocus={event=>event.currentTarget.select()} onChange={event=>setRenaming({id,name:event.target.value})}/>
          <button type="submit" aria-label="Save name" title="Save name" disabled={busy||!renaming.name.trim()}><Check size={13}/></button>
          <button type="button" aria-label="Cancel rename" title="Cancel rename" onClick={()=>setRenaming(null)}><X size={13}/></button>
        </form> : <button className="collection-disclosure" aria-expanded={open} onClick={()=>toggle(id)}><ChevronRight size={12} className={open?"collection-chevron open":"collection-chevron"}/><FolderOpen size={14}/><span>{label}</span><small>{total}</small></button>}
        <button className="collection-more-button" aria-label={`Manage ${label}`} title={`Manage ${label}`} aria-haspopup="menu" aria-expanded={menuTarget?.id===id} onClick={event=>{
          if(menuTarget?.id===id){setMenuTarget(null);return;}
          const rect=event.currentTarget.getBoundingClientRect();setMenuTarget({id,name:label,x:rect.right-220,y:rect.bottom+4,trigger:event.currentTarget});
        }}><MoreHorizontal size={16}/></button>
      </div>
      {open&&<div className="collection-requests">
        {creationFolder===id&&form()}
        {childNodes}
        {requests.map(r=><div key={r.id}>
          {zone(`before-request:${r.id}`,id||undefined,r.id)}
          <div className="library-request-draggable">
            <span className="library-drag-handle" role="button" tabIndex={0} draggable={!busy} aria-label={`Drag request ${r.name} to move`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft" onKeyDown={event=>keyboardMove(event,{kind:"request",id:r.id},id||undefined)} title="Drag to reorder or move to a folder" onDragStart={event=>start(event,{kind:"request",id:r.id})} onDragEnd={()=>{setDrag(null);setOver("");}}><GripVertical size={12}/></span>
            {renderRequest(r)}
          </div>
        </div>)}
        <div className={`library-drop-end ${!drag?"is-idle":""} ${over===`end:${id}`?"library-drop-inside":""}`} {...dropProps(`end:${id}`,id||undefined)}>{drag?`Move into ${label}`:""}</div>
        {!allRequests.length&&!children.length&&creationFolder!==id&&<p className="collection-empty">No requests yet</p>}
      </div>}
    </section>;
  }
  function form(){return <form className="new-collection-form" onSubmit={event=>{event.preventDefault();if(name.trim())onCreate(name.trim(),creationFolder||undefined);}} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();onCancelCreate();}}}>
    <strong>{creationFolder?"New folder":"New collection"}</strong>
    <input autoFocus aria-label={creationFolder?"Folder name":"Collection name"} placeholder={creationFolder?"Folder name":"Collection name"} maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/>
    <div><button type="submit" disabled={busy||!name.trim()}><Plus size={14}/> Create</button><button type="button" aria-label="Cancel creation" onClick={onCancelCreate}><X size={14}/></button></div>
  </form>;}
  return <div className={`request-collections ${drag?"is-dragging":""}`}>
    {menuTarget&&<CollectionActionsMenu target={menuTarget} busy={busy} onClose={()=>setMenuTarget(null)}
      onDocument={()=>onViewDocumentation({kind:"collection",id:menuTarget.id})}
      onFolder={()=>{setCollapsed(prev=>{const next=new Set(prev);next.delete(menuTarget.id);return next;});onStartCreate(menuTarget.id);}}
      onRequest={()=>{setCollapsed(prev=>{const next=new Set(prev);next.delete(menuTarget.id);return next;});onNewRequest(menuTarget.id||undefined);}}
      onRename={()=>setRenaming({id:menuTarget.id,name:menuTarget.name})}
      onDelete={()=>onDelete(menuTarget.id)}
    />}
    {creationFolder===""&&form()}

    {workspace.requests.some(r=>!r.collectionId)&&node("","Unfiled","")}
    {collections.filter(c=>!c.parentId).map(c=>node(c.id,c.name,""))}
    <div className={`library-drop-end ${!drag?"is-idle":""}`} {...dropProps("root-end")}>{drag?.kind==="collection"?"Move to top level":drag?"Move to Unfiled":""}</div>
  </div>;
}
