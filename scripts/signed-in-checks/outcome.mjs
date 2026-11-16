import { OWNER_CHECKS as C } from './config.mjs';

/**
 * Outcomes and verdicts. An outcome records only a transport, a status, a stable detail code and a
 * row count, never a body, header or token, so a report built from outcomes cannot leak credentials,
 * emails or sequences.
 */

export const VERDICTS = { pass: 'PASS', fail: 'FAIL', inconclusive: 'INCONCLUSIVE', skipped: 'SKIPPED' };

/** A server detail only when it looks like one of the backend's stable codes. */
export function stableDetail(value) {
  return typeof value === 'string' && C.detailPattern.test(value) ? value : null;
}

/** Outcome of a gRPC-Web call. `codeNames` is the Connect `Code` enum (number → name). */
export function rpcFailure(error, codeNames) {
  if (typeof error?.code === 'number' && typeof error?.rawMessage === 'string') {
    return { transport: 'rpc', status: String(codeNames[error.code] ?? error.code), detail: stableDetail(error.rawMessage), rows: null };
  }
  // The app's own clients report ApiError categories (session, not-found, conflict…).
  if (typeof error?.code === 'string' && error?.name === 'ApiError') return { transport: 'app', status: error.code, detail: null, rows: null };
  return { transport: 'rpc', status: 'transport-error', detail: null, rows: null };
}

export const rpcSuccess = (transport = 'rpc') => ({ transport, status: 'OK', detail: null, rows: null });

/**
 * Outcome of a REST answer; only the status, a stable detail/code and the array length are kept.
 * A JSON `null` counts as zero rows; an empty body (204 after a delete) does not, since it means done.
 */
export function httpOutcome(transport, status, bodyText) {
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : undefined; } catch { body = undefined; }
  const code = typeof body?.code === 'string' && C.postgrestCodePattern.test(body.code) ? body.code : null;
  const detail = stableDetail(body?.detail) ?? code;
  const rows = Array.isArray(body) ? body.length : body === null ? 0 : null;
  return { transport, status: String(status), detail, rows };
}

export const transportFailure = (transport) => ({ transport, status: 'transport-error', detail: null, rows: null });

const RPC_CLASSES = {
  Unauthenticated: 'unauthenticated',
  NotFound: 'denied', PermissionDenied: 'denied',
  ResourceExhausted: 'rate-limited',
  InvalidArgument: 'refused', FailedPrecondition: 'refused', Aborted: 'refused', AlreadyExists: 'refused', OutOfRange: 'refused',
  OK: 'accepted',
};
const APP_CLASSES = {
  session: 'unauthenticated', 'not-found': 'denied', forbidden: 'denied', 'rate-limit': 'rate-limited',
  conflict: 'refused', validation: 'refused', 'requires-current-client': 'refused', 'draft-changed': 'refused',
  'laboratory-size': 'refused', 'generator-history-size': 'refused', OK: 'accepted',
};

/**
 * One of: unauthenticated, denied (absent or not yours), empty (answered with nothing), refused
 * (authenticated but rejected), rate-limited, accepted (answered with data), unavailable.
 */
export function classify(outcome) {
  if (outcome.status === 'transport-error') return 'unavailable';
  if (outcome.transport === 'rpc') return RPC_CLASSES[outcome.status] ?? 'unavailable';
  if (outcome.transport === 'app') return APP_CLASSES[outcome.status] ?? 'unavailable';
  const status = Number(outcome.status);
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'rate-limited';
  if (status === 403 || status === 404) return 'denied';
  if (outcome.transport === 'supabase' && C.supabaseDeniedCodes.includes(outcome.detail)) return 'denied';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'refused';
  if (status >= 200 && status < 300) return outcome.rows === 0 ? 'empty' : 'accepted';
  return 'unavailable';
}

/** Printable summary of an outcome: never more than transport, status, detail and row count. */
export function describe(outcome) {
  const parts = [outcome.transport, outcome.status];
  if (outcome.detail) parts.push(outcome.detail);
  if (outcome.rows !== null && outcome.rows !== undefined) parts.push(`rows=${String(outcome.rows)}`);
  return parts.join(' ');
}

const verdict = (result, outcome, note) => ({ verdict: result, observed: note ? `${describe(outcome)} (${note})` : describe(outcome) });

/** A tampered or expired token must be refused before anything else happens. */
export function expectTokenRejected(outcome) {
  const kind = classify(outcome);
  if (kind === 'unauthenticated') return verdict(VERDICTS.pass, outcome);
  if (kind === 'unavailable') return verdict(VERDICTS.inconclusive, outcome, 'service did not answer');
  return verdict(VERDICTS.fail, outcome, 'token was not refused');
}

/** Control: the genuine token passes authentication (a later validation or absence is expected). */
export function expectTokenAccepted(outcome) {
  const kind = classify(outcome);
  if (kind === 'unauthenticated') return verdict(VERDICTS.fail, outcome, 'valid token refused');
  if (kind === 'unavailable') return verdict(VERDICTS.inconclusive, outcome, 'service did not answer');
  return verdict(VERDICTS.pass, outcome);
}

/** Another account must get a refusal or nothing at all; any data or change is a failure. */
export function expectNoAccess(outcome) {
  const kind = classify(outcome);
  if (kind === 'denied' || kind === 'empty' || kind === 'refused') return verdict(VERDICTS.pass, outcome);
  if (kind === 'accepted') return verdict(VERDICTS.fail, outcome, 'the other account got data or made a change');
  if (kind === 'unauthenticated') return verdict(VERDICTS.inconclusive, outcome, 'second account not authenticated');
  return verdict(VERDICTS.inconclusive, outcome, 'service did not answer');
}

/** A control that must return exactly `rows` rows (for example, the owner reading its own project). */
export function expectRows(outcome, rows) {
  if (classify(outcome) === 'unavailable') return verdict(VERDICTS.inconclusive, outcome, 'service did not answer');
  return verdict(outcome.rows === rows ? VERDICTS.pass : VERDICTS.fail, outcome, outcome.rows === rows ? null : `expected rows=${String(rows)}`);
}

/** A plain local condition (comparison, hash check) as a report row. */
export function expectTrue(condition, observed) {
  return { verdict: condition ? VERDICTS.pass : VERDICTS.fail, observed };
}

/**
 * Quota verdict over consecutive calls of one identity. `outcomes` holds calls 1…limit+1 in order.
 * Pass only when exactly `limit` calls passed the budget and the next one met the API's own limit,
 * all inside one window. A shared or multi-instance deployment can make the result inconclusive.
 */
export function evaluateQuota(outcomes, { limit, windowMs, elapsedMs, singleProcess }) {
  const kinds = outcomes.map(classify);
  const last = outcomes.at(-1);
  const summary = `${String(kinds.filter((kind) => kind !== 'rate-limited').length)} counted, call ${String(outcomes.length)}: ${last ? describe(last) : 'none'}`;
  const result = (value, note) => ({ verdict: value, observed: note ? `${summary} (${note})` : summary });
  if (outcomes.length !== limit + 1) return result(VERDICTS.inconclusive, `expected ${String(limit + 1)} calls`);
  if (kinds.includes('unauthenticated')) return result(VERDICTS.inconclusive, 'token refused during the count');
  if (elapsedMs >= windowMs) return result(VERDICTS.inconclusive, 'calls did not fit in one window');
  const first = kinds.indexOf('rate-limited');
  if (first === -1) return singleProcess ? result(VERDICTS.fail, 'no limit after the budget') : result(VERDICTS.inconclusive, 'several instances may each keep a budget');
  const limited = outcomes[first];
  if (limited.detail === C.quota.providerLimitDetail) return result(VERDICTS.inconclusive, 'the provider limited, not the API');
  if (first < limit) return result(VERDICTS.inconclusive, 'budget already partly used; wait a minute and rerun');
  if (limited.detail !== null && limited.detail !== C.quota.ownBudgetDetail) return result(VERDICTS.inconclusive, 'unexpected limit code');
  return result(VERDICTS.pass);
}

/** Downgrades passes to inconclusive when the control that gives them meaning did not pass. */
export function dependOn(control, row) {
  if (control.verdict === VERDICTS.pass || row.verdict !== VERDICTS.pass) return row;
  return { ...row, verdict: VERDICTS.inconclusive, observed: `${row.observed} (control did not pass)` };
}

/** Plain text table; cells hold only labels, verdicts and outcome summaries. */
export function renderTable(rows) {
  const header = { check: 'Check', verdict: 'Result', observed: 'Observed' };
  const all = [header, ...rows];
  const width = (key) => Math.max(...all.map((row) => row[key].length));
  const [w1, w2] = [width('check'), width('verdict')];
  const line = (row) => `${row.check.padEnd(w1)}  ${row.verdict.padEnd(w2)}  ${row.observed}`;
  return [line(header), `${'-'.repeat(w1)}  ${'-'.repeat(w2)}  ${'-'.repeat(width('observed'))}`, ...rows.map(line)].join('\n');
}

/** 0 when every row passed or was skipped, 1 on any failure, 2 when only inconclusive rows remain. */
export function exitCode(rows) {
  if (rows.some((row) => row.verdict === VERDICTS.fail)) return 1;
  if (rows.some((row) => row.verdict === VERDICTS.inconclusive)) return 2;
  return 0;
}
