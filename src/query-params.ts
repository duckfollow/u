export type QueryParam = {key:string;value:string};
export function splitQueryUrl(url:string) {
  const hash=url.indexOf('#');const fragment=hash<0?'':url.slice(hash);
  const before=hash<0?url:url.slice(0,hash);const query=before.indexOf('?');
  return {base:query<0?before:before.slice(0,query),query:query<0?'':before.slice(query+1),fragment};
}
export function parseQueryParams(url:string):QueryParam[] {
  return [...new URLSearchParams(splitQueryUrl(url).query)].map(([key,value])=>({key,value}));
}
function encode(value:string):string {
  return value.split(/(\{\{[^{}]+\}\})/g).map(part=>/^\{\{[^{}]+\}\}$/.test(part)?part:encodeURIComponent(part)).join('');
}
export function writeQueryParams(url:string,params:QueryParam[]):string {
  const {base,fragment}=splitQueryUrl(url);
  const query=params.filter(p=>p.key!=='').map(p=>`${encode(p.key)}=${encode(p.value)}`).join('&');
  return base+(query?'?'+query:'')+fragment;
}
