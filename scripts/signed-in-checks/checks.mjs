/**
 * Bodies of the three owner checks. The entry scripts (isolation.mjs, gateway.mjs,
 * generator-history.mjs) hand them a context from session.mjs; tests hand them one over mocks.
 */
import { checkProjectName } from './app.mjs';
import { OWNER_CHECKS as C } from './config.mjs';
import { dependOn, evaluateQuota, expectNoAccess, expectRows, expectTokenAccepted, expectTokenRejected, expectTrue, VERDICTS } from './outcome.mjs';
import { gatewayProbes } from './probes.mjs';
import { deleteCheckProject, emptyWorkspace } from './session.mjs';
import { sameSubject, secondsUntilExpired, signatureDifference, tamperSignature } from './token.mjs';

/** (a) A creates a check project; B is refused on every path by id; A verifies and deletes it. */
export async function isolationCheck(context) {
  const { modules, targets, record, write } = context;
  const a = await context.signIn('Account A');
  const b = await context.signIn('Account B');
  const tokenA = () => a.session.accessToken;
  const tokenB = () => b.session.accessToken;
  if (sameSubject(tokenA(), tokenB())) throw new Error('Accounts A and B are the same account; B must be a different account.');

  const projects = modules.createProjectApi(targets.apiBase);
  const workspace = emptyWorkspace(modules);
  const name = checkProjectName('aislamiento');
  const created = await context.app(() => projects.save({ name, activeSequence: '', workspace }, tokenA()));
  record('A creates the check project', expectTrue(created.value !== null, created.value ? 'app OK' : `${created.outcome.transport} ${created.outcome.status}`));
  if (!created.value) return;
  const project = created.value;
  const marker = `${name} · B`;
  const s = C.supabaseRest;
  const byId = `${s.table}?id=eq.${project.id}`;

  try {
    write('Controls with account A…');
    const restControl = record('control: A reads it through the API (REST)', expectTokenAccepted(await context.rest('GET', C.rest.project(project.id), tokenA())));
    const supabaseControl = record('control: A reads it through Supabase REST', expectRows(await context.supabase('GET', `${byId}&select=id`, tokenA()), 1));

    write('Account B tries the same id…');
    const opened = await context.app(() => projects.open(project.id, tokenB()));
    record('B reads by id (app client, gRPC-Web)', expectNoAccess(opened.outcome));
    const updated = await context.app(() => projects.save({ name: marker, activeSequence: '', workspace }, tokenB(), { id: project.id, updatedAt: project.updatedAt }));
    record('B updates by id (app client, gRPC-Web)', expectNoAccess(updated.outcome));
    const removed = await context.app(() => projects.remove(project.id, project.updatedAt, tokenB()));
    record('B deletes by id (app client, gRPC-Web)', expectNoAccess(removed.outcome));
    const listed = await context.app(() => projects.list(tokenB(), '', undefined, { ...modules.DEFAULT_PROJECT_QUERY, query: name }));
    record('B list does not include it (app client)', listed.value
      ? expectTrue(!listed.value.items.some((item) => item.id === project.id), 'app OK, compared by id')
      : { verdict: VERDICTS.inconclusive, observed: `${listed.outcome.transport} ${listed.outcome.status}` });

    const rest = (check, method, path, body) => context.rest(method, path, tokenB(), body).then((outcome) => record(check, dependOn(restControl, expectNoAccess(outcome))));
    await rest('B reads by id (API REST)', 'GET', C.rest.project(project.id));
    await rest('B updates by id (API REST)', 'PUT', C.rest.project(project.id), { name: marker, activeSequence: '', workspace, expectedUpdatedAt: project.updatedAt });
    await rest('B deletes by id (API REST)', 'DELETE', `${C.rest.project(project.id)}?expectedUpdatedAt=${encodeURIComponent(project.updatedAt)}`);

    const supabase = (check, method, path, body) => context.supabase(method, path, tokenB(), body).then((outcome) => record(check, dependOn(supabaseControl, expectNoAccess(outcome))));
    await supabase('B reads the row (Supabase REST)', 'GET', `${byId}&select=id`);
    await supabase('B updates the row (Supabase REST)', 'PATCH', byId, { name: marker });
    await supabase('B deletes the row (Supabase REST)', 'DELETE', byId);
    await supabase('B reads the document (Supabase RPC)', 'POST', s.documentRpc, { p_id: project.id });
    await supabase('B saves over it (Supabase RPC)', 'POST', s.saveRpc, { p_id: project.id, p_name: marker, p_sequence: '', p_workspace: workspace, p_expected_updated_at: project.updatedAt });
    await supabase('B deletes it (Supabase RPC)', 'POST', s.deleteRpc, { p_id: project.id, p_expected_updated_at: project.updatedAt });

    write('Account A checks the project…');
    const after = await context.app(() => projects.open(project.id, tokenA()));
    record('A finds it unchanged (name and update time)', after.value
      ? expectTrue(after.value.name === project.name && after.value.updatedAt === project.updatedAt, 'app OK, compared')
      : { verdict: VERDICTS.fail, observed: `${after.outcome.transport} ${after.outcome.status} (missing for its owner)` });
  } finally {
    await deleteCheckProject(context, projects, project, tokenA, name);
  }
}


/** (b) Genuine, tampered and expired copies of one token on every gateway method, plus the reference quota. */
export async function gatewayCheck(context, options) {
  const { record, write } = context;
  const owner = await context.signIn('Owner');
  const token = owner.session.accessToken;
  const probes = gatewayProbes(context);

  write('Controls with the genuine token…');
  for (const probe of probes) record(`genuine token passes: ${probe.label}`, expectTokenAccepted(await probe.run(token)));

  const tampered = tamperSignature(token);
  record('tampered copy differs in one signature byte', expectTrue(signatureDifference(token, tampered) === 1, 'local comparison'));
  write('Tampered token…');
  for (const probe of probes) record(`tampered token refused: ${probe.label}`, expectTokenRejected(await probe.run(tampered)));

  write('Quota: waiting for any earlier reference window to lapse. Do not use the app meanwhile.');
  await context.wait(C.quota.settleSeconds, 'remaining');
  await checkQuota(context, token);

  if (options.skipExpired) {
    record('expired token refused', { verdict: VERDICTS.skipped, observed: '--skip-expired' });
    return;
  }
  const wait = secondsUntilExpired(token, C.expirySkewSeconds);
  if (wait === null) throw new Error('The session token has no expiry claim.');
  write('Expired token: keeping the original token in memory until it expires. Leave this window open.');
  await context.wait(wait, 'until expiry');
  for (const probe of probes) record(`expired token refused: ${probe.label}`, expectTokenRejected(await probe.run(token)));
}

/**
 * Calls 1…limit spend the identity's shared reference budget (GetEntry, one SIFTS mapping in second
 * place); call limit+1 is a SIFTS mapping that must meet the API's own 429/RESOURCE_EXHAUSTED.
 */
async function checkQuota(context, token) {
  const { modules, targets, record, write } = context;
  const q = C.quota;
  const references = modules.createRpcClient(modules.ReferenceService, targets.apiBase);
  const options = () => modules.callOptions(undefined, token);
  let sequenceVersion = null;
  const entry = () => context.rpc(async () => {
    const response = await references.getEntry({ accession: q.accession }, options());
    sequenceVersion ??= response.entry?.sequenceVersion ?? null;
  });
  const mapping = () => context.rpc(() => {
    if (!sequenceVersion) throw new Error('No sequence version');
    return references.getResidueMapping({ pdbId: q.pdbId, accession: q.accession, sequenceVersion }, { ...options(), timeoutMs: C.mappingTimeoutMs });
  });
  write(`Quota: ${String(q.limit + 1)} sequential reference calls…`);
  const started = Date.now();
  const outcomes = [];
  for (let call = 1; call <= q.limit + 1; call += 1) {
    const sifts = call === 2 || call === q.limit + 1;
    const outcome = await (sifts ? mapping() : entry());
    outcomes.push(outcome);
    if (call === 2) record('SIFTS mapping answers the signed-in identity', expectTrue(outcome.status === 'OK', `rpc ${outcome.status}${outcome.detail ? ` ${outcome.detail}` : ''}`));
  }
  record(`reference quota ${String(q.limit)}/min, call ${String(q.limit + 1)} (SIFTS) refused`, evaluateQuota(outcomes, {
    limit: q.limit, windowMs: q.windowSeconds * 1000, elapsedMs: Date.now() - started, singleProcess: targets.singleProcess,
  }));
}

/** (c) Save a locally computed search to a check project, count it, reopen and verify it, delete it. */
export async function generatorHistoryCheck(context) {
  const { modules, targets, record, write } = context;
  const owner = await context.signIn('Owner');
  const token = () => owner.session.accessToken;
  const projects = modules.createProjectApi(targets.apiBase);

  write('Running the default candidate search locally…');
  const parameters = modules.parseSearchForm(modules.INITIAL_SEARCH_FORM);
  if (!parameters.success) throw new Error('The default search form no longer validates.');
  // Same text the generator downloads and saves (useGeneratorSave.tsx).
  const resultJson = JSON.stringify(await modules.searchCandidates(parameters.data), null, 2);
  const run = await modules.createGeneratorRun(resultJson, { recordedAt: new Date().toISOString(), appBuild: null, selection: null });
  const { history } = await modules.addGeneratorRun(undefined, run);
  const workspace = await modules.withGeneratorHistory(emptyWorkspace(modules), history);

  const name = checkProjectName('historial del generador');
  write('Saving to a new check project…');
  const saved = await context.app(() => projects.save({ name, activeSequence: '', workspace }, token()));
  if (!saved.value) {
    record('search saved to a new check project', { verdict: VERDICTS.fail, observed: `${saved.outcome.transport} ${saved.outcome.status}` });
    return;
  }
  const project = saved.value;
  try {
    record('search saved to a new check project', expectTrue(project.workspace.generatorHistory?.documentSha256 === history.documentSha256, 'app OK, history hash compared'));

    const listed = await context.app(() => projects.list(token(), '', undefined, { ...modules.DEFAULT_PROJECT_QUERY, query: name }));
    const item = listed.value?.items.find((entry) => entry.id === project.id);
    record('project list counts 1 saved search', item
      ? expectTrue(item.preview?.generatorRuns === 1, `generatorRuns=${String(item.preview?.generatorRuns ?? 'absent')}`)
      : { verdict: VERDICTS.fail, observed: listed.value ? 'project not listed' : `${listed.outcome.transport} ${listed.outcome.status}` });

    const reopened = await context.app(() => projects.open(project.id, token()));
    const stored = reopened.value?.workspace.generatorHistory ?? null;
    if (!stored) {
      record('reopened history verifies', { verdict: VERDICTS.fail, observed: reopened.value ? 'no history stored' : `${reopened.outcome.transport} ${reopened.outcome.status}` });
      return;
    }
    record('reopened history verifies (document and run hashes)', expectTrue(await modules.verifyGeneratorHistory(stored), 'verifyGeneratorHistory'));
    const runs = modules.generatorHistoryRuns(stored);
    const same = runs.length === 1 && runs[0].id === run.id && runs[0].resultJson === resultJson && modules.readGeneratorResult(runs[0].resultJson) !== null;
    record('reopened search equals the saved export', expectTrue(same, `runs=${String(runs.length)}, compared byte for byte`));
  } finally {
    await deleteCheckProject(context, projects, project, token, name);
  }
}
