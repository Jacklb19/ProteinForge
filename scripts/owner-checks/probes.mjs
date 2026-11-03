import { OWNER_CHECKS as C } from './config.mjs';

/**
 * Every authenticated gateway method, gRPC-Web and REST, with inputs that can never change stored
 * data or reach a provider: an absent project id, an empty name, an invalid accession, a two-residue
 * sequence without consent. A genuine token therefore gets a validation or "not found" answer, and a
 * refused token gets "unauthenticated"; any other answer to a bad token means it was not refused.
 */
export function gatewayProbes(context) {
  const { modules, targets } = context;
  const p = C.probeInputs;
  const client = (service) => modules.createRpcClient(service, targets.apiBase);
  const account = client(modules.AccountService);
  const projects = client(modules.ProjectService);
  const references = client(modules.ReferenceService);
  const assistant = client(modules.AssistantService);
  const folding = client(modules.FoldingService);
  const options = (token) => modules.callOptions(undefined, token);
  const rpc = (label, call) => ({ label: `rpc ${label}`, run: (token) => context.rpc(() => call(options(token))) });
  const rest = (method, path, body) => ({ label: `rest ${method} ${path.split('?')[0].replace(p.absentProjectId, '{id}')}`, run: (token) => context.rest(method, path, token, body) });
  const r = C.rest;
  return [
    rpc('AccountService/GetMe', (o) => account.getMe({}, o)),
    rpc('ProjectService/ListProjects', (o) => projects.listProjects({}, o)),
    rpc('ProjectService/GetProject', (o) => projects.getProject({ id: p.absentProjectId }, o)),
    rpc('ProjectService/CreateProject', (o) => projects.createProject({ name: '' }, o)),
    rpc('ProjectService/UpdateProject', (o) => projects.updateProject({ id: p.absentProjectId, name: '' }, o)),
    rpc('ProjectService/DeleteProject', (o) => projects.deleteProject({ id: p.absentProjectId }, o)),
    rpc('ReferenceService/SearchEntries', (o) => references.searchEntries({ query: '' }, o)),
    rpc('ReferenceService/GetEntry', (o) => references.getEntry({ accession: p.invalidAccession }, o)),
    rpc('ReferenceService/GetResidueMapping', (o) => references.getResidueMapping({ pdbId: p.invalidPdbId, accession: p.invalidAccession, sequenceVersion: 0 }, o)),
    rpc('AssistantService/Interpret', (o) => assistant.interpret({}, o)),
    rpc('FoldingService/Predict', (o) => folding.predict({ sequence: p.shortSequence, consentToSendSequence: false }, o)),
    rest('GET', r.me),
    rest('GET', r.projects),
    rest('GET', r.project(p.absentProjectId)),
    rest('POST', r.projects, {}),
    rest('PUT', r.project(p.absentProjectId), {}),
    rest('DELETE', `${r.project(p.absentProjectId)}?expectedUpdatedAt=${encodeURIComponent(p.absentProjectTime)}`),
    rest('GET', `${r.uniprotSearch}?query=`),
    rest('GET', r.uniprotEntry(p.invalidAccession)),
    rest('GET', `${r.residueMapping(p.invalidPdbId)}?accession=${p.invalidAccession}&sequence_version=0`),
    rest('POST', r.interpret, {}),
    rest('POST', r.fold, { sequence: p.shortSequence, consentToSendSequence: false }),
  ];
}
