import type { Flow, RequestSpec, Step, Workspace } from "./model.ts";
import { EXAMPLE_DEMO_ORIGIN } from "./example-demo.ts";
import { addAuthExamples, authExamples, EXAMPLES_FOLDER } from "./auth-examples.ts";
export type ExamplePackId = "authorization" | "http-basics" | "variables" | "crud";
export type ExamplePack = { id: ExamplePackId; title: string; summary: string; instructions: string; requests: RequestSpec[]; flows: Flow[] };
function request(pack: ExamplePackId, key: string, name: string, method: string, path: string, description: string, body = "", headers: Record<string,string> = {}): RequestSpec {
  return {id: `example-${pack}-${key}`, collectionId: `examples-${pack}`, name, method, url: EXAMPLE_DEMO_ORIGIN + path, headers: JSON.stringify(headers, null, 2), body, auth: "", description: `${description}\nLocal simulation · no external service required.`};
}
const json = {"Content-Type":"application/json"};
const basics = [
  request("http-basics", "get", "GET · query parameters", "GET", "/echo?search=hello%20world&limit=10", "Click Send. Expect HTTP 200 with query.search = hello world and query.limit = 10."),
  request("http-basics", "headers", "GET · custom headers", "GET", "/echo", "Click Send. Expect HTTP 200 with your X-Request-ID and Accept values echoed in headers.", "", {Accept:"application/json", "X-Request-ID":"u-example-001"}),
  ...["POST", "PUT", "PATCH"].map(method => request("http-basics", method.toLowerCase(), `${method} · JSON body`, method, "/echo", `Click Send. Expect HTTP 200 with method = ${method} and your JSON in body. This endpoint echoes data; use CRUD Workflow to change stored projects.`, '{"name":"Example project","status":"active"}', json)),
  request("http-basics", "delete", "DELETE · request", "DELETE", "/echo?id=1", "Click Send. Expect HTTP 200 with method = DELETE. This echo does not delete stored projects."),
  request("http-basics", "head", "HEAD · response headers", "HEAD", "/echo", "Click Send. Expect HTTP 200 with response headers and an empty body."),
  request("http-basics", "options", "OPTIONS · allowed methods", "OPTIONS", "/echo", "Click Send. Expect HTTP 204, an empty body and the Allow response header."),
];
const variableRequests = [
  {...request("variables", "context", "Environment · URL and headers", "GET", "", "Select Examples · Local or Examples · Development, then Send. Expect HTTP 200. Compare environment, query.name and headers.x-demo-label when switching environments.", "", {"X-Demo-Label":"{{demoLabel}}"}), url: "{{baseUrl}}/context?name={{demoName}}"},
  {...request("variables", "body", "Environment · JSON body", "POST", "", "Select an Examples environment, then Send. Expect HTTP 200 with your environment's demoName and demoLabel in body.", '{"name":"{{demoName}}","label":"{{demoLabel}}"}', json), url: "{{baseUrl}}/echo"},
];
function step(id: string, spec: RequestSpec): Step { return {id, name: spec.name, kind:"request", request: {...spec}, value:""}; }
const variablesFlow: Flow = {id:"example-variables-flow", name:"Examples · Variables → next request", steps:[
  step("context", variableRequests[0]),
  step("reuse", {...variableRequests[1], name:"Reuse response values", body:'{"name":"{{steps.context.body.query.name}}","environment":"{{steps.context.body.environment}}"}', description:"Run after Environment. Expect HTTP 200 with the previous response's name and environment in body."}),
]};
const crud = [
  request("crud", "list", "1 · List projects", "GET", "/projects", "Click Send. Expect HTTP 200 and the current projects array. Reset demo data restores the initial project."),
  request("crud", "create", "2 · Create project", "POST", "/projects", "Click Send. Expect HTTP 201 with a new id and a Location header. Use the workflow to pass this id automatically.", '{"name":"New demo project","status":"draft"}', json),
  request("crud", "read", "3 · Read project", "GET", "/projects/1", "Click Send. Expect HTTP 200 for project 1. If it was deleted, use Reset demo data first."),
  request("crud", "replace", "4 · Replace project", "PUT", "/projects/1", "Click Send. Expect HTTP 200. PUT requires both name and status in this demo.", '{"name":"Replaced demo project","status":"active"}', json),
  request("crud", "update", "5 · Update project", "PATCH", "/projects/1", "Click Send. Expect HTTP 200 with status = archived; name is preserved.", '{"status":"archived"}', json),
  request("crud", "delete", "6 · Delete project", "DELETE", "/projects/1", "Click Send. Expect HTTP 204 and no body. A subsequent read returns 404. Reset demo data restores project 1."),
];
const createdUrl = EXAMPLE_DEMO_ORIGIN + "/projects/{{steps.create.body.id}}";
const crudFlow: Flow = {id:"example-crud-flow", name:"Examples · Create → read → update → delete", steps:[
  step("create", crud[1]),
  step("read", {...crud[2], name:"Read created project", url:createdUrl, description:"Run after Create. Expect HTTP 200 for the id from steps.create.body.id."}),
  step("update", {...crud[4], name:"Update created project", url:createdUrl, description:"Run after Create. Expect HTTP 200 with status = archived for the newly created project."}),
  step("delete", {...crud[5], name:"Delete created project", url:createdUrl, description:"Run after Create. Expect HTTP 204. Only the project created by this workflow is deleted."}),
]};
export const examplePacks: ExamplePack[] = [
  {id:"authorization", title:"Authorization", summary:"Basic, Bearer, API keys, sessions and OAuth 2.0", instructions:"Ready-to-run local simulations. Inspect expected success and failure responses. The included OAuth workflow passes its token to the next request.", requests:[], flows:[]},
  {id:"http-basics", title:"HTTP Basics", summary:"Methods, query parameters, headers and JSON bodies", instructions:"Add the pack, open a request and click Send. The echo endpoint returns what you sent without changing stored projects.", requests:basics, flows:[]},
  {id:"variables", title:"Variables & Environments", summary:"Switch environments and reuse response values", instructions:"Adding this pack selects Examples · Local. Switch to Examples · Development using the environment menu to compare results. Open the included flow and Run flow to reuse the first response in the second request. Existing environments are preserved.", requests:variableRequests, flows:[variablesFlow]},
  {id:"crud", title:"CRUD Workflow", summary:"Create, read, replace, update and delete demo projects", instructions:"Try individual requests in order, or open the included flow and click Run flow. The flow uses the newly created id and can be run repeatedly. Reset demo data restores project 1; it does not change saved requests or environments.", requests:crud, flows:[crudFlow]},
];
export function packCounts(pack: ExamplePack) { return pack.id === "authorization" ? {requests:authExamples.length, flows:1} : {requests:pack.requests.length, flows:pack.flows.length}; }
export function addExamplePack(workspace: Workspace, id: ExamplePackId): Workspace {
  if (id === "authorization") return addAuthExamples(workspace);
  const pack = examplePacks.find(p => p.id === id)!;
  const collectionId = `examples-${id}`;
  const ids = new Set(pack.requests.map(r => r.id));
  const requests = workspace.requests.map(r => ids.has(r.id) && !r.collectionId ? {...r, collectionId} : r);
  const existing = new Set(requests.map(r => r.id));
  let result: Workspace = {...workspace,
    collections: workspace.collections?.some(c => c.id === collectionId) ? workspace.collections : [...(workspace.collections ?? []), {id:collectionId, name:pack.title, folder:EXAMPLES_FOLDER}],
    requests:[...requests, ...structuredClone(pack.requests.filter(r => !existing.has(r.id)))],
    flows:[...workspace.flows, ...structuredClone(pack.flows.filter(f => !workspace.flows.some(saved => saved.id === f.id)))],
  };
  if (id === "variables") {
    const environments = {...workspace.environments};
    for (const [label, environment, demoName] of [["Local", "local", "Tony"], ["Development", "development", "Pepper"]]) {
      const key = `Examples · ${label}`;
      if (!Object.hasOwn(environments, key)) environments[key] = JSON.stringify({baseUrl:`${EXAMPLE_DEMO_ORIGIN}/environments/${environment}`, demoName, demoLabel:label}, null, 2);
    }
    result = {...result, environments, environment:"Examples · Local"};
  }
  return result;
}
export function isExampleCollection(id: string) { return examplePacks.some(p => `examples-${p.id}` === id); }
