import type { RequestSpec, ResponseExample, Result } from "./model.ts";
import { authExamples, exampleRequest, authDemoResponse } from "./auth-examples.ts";
import { examplePacks } from "./example-packs.ts";
import { exampleDemoResponse } from "./example-demo.ts";

export function captureResponse(result: Result, id: string): ResponseExample {
  return {id, name:`Saved · ${result.status} ${result.statusText}`, status:result.status, statusText:result.statusText, headers:structuredClone(result.headers), body:structuredClone(result.body)};
}
export function builtInResponseExamples(id: string): ResponseExample[] {
  const auth = authExamples.find(e => `auth-example-${e.key}` === id);
  let result: Pick<Result,"status"|"statusText"|"headers"|"body"> | undefined;
  if (auth) {
    const spec = exampleRequest(auth);
    const headers = JSON.parse(spec.headers);
    if (spec.auth) headers.Authorization = `Bearer ${spec.auth}`;
    result = authDemoResponse({...spec, headers});
  } else {
    const spec = examplePacks.flatMap(p => p.requests).find(r => r.id === id);
    if (!spec) return [];
    if (id.startsWith("example-crud-")) {
      const project = {id:1,name:"Demo project",status:"active"};
      let status = 200;
      let body: unknown = project;
      const headers: Record<string,string> = {"content-type":"application/json"};
      if (id.endsWith("-list")) body = {projects:[project]};
      else if (id.endsWith("-create")) { status=201; body={id:2,name:"New demo project",status:"draft"}; headers.location="https://examples.u.local/projects/2"; }
      else if (id.endsWith("-replace")) body={...project,name:"Replaced demo project"};
      else if (id.endsWith("-update")) body={...project,status:"archived"};
      else if (id.endsWith("-delete")) {status=204;body="";}
      result={status,statusText:status===201?"Created":status===204?"No Content":"OK",headers,body};
    } else {
      const demo = {baseUrl:"https://examples.u.local/environments/local",demoName:"Tony",demoLabel:"Local"};
      const interpolate = (text: string) => text.replace(/\{\{(baseUrl|demoName|demoLabel)\}\}/g,(_,key:keyof typeof demo)=>demo[key]);
      result = exampleDemoResponse({url:interpolate(spec.url),method:spec.method,headers:JSON.parse(interpolate(spec.headers)),body:interpolate(spec.body)});
    }
  }
  return result ? [{id:`builtin-${id}`,name:"Illustrative demo response",...result}] : [];
}
export function responseExamples(request: RequestSpec): ResponseExample[] {
  return [...builtInResponseExamples(request.id), ...(request.responseExamples ?? [])];
}
