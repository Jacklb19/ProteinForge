import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { checkProjectName, isLoopback, parseArguments } from './app.mjs';
import { OWNER_CHECKS as C } from './config.mjs';
import { classify, dependOn, describe as summary, evaluateQuota, exitCode, expectNoAccess, expectRows, expectTokenAccepted, expectTokenRejected, httpOutcome, renderTable, rpcFailure, stableDetail, VERDICTS } from './outcome.mjs';
import { applyKeystrokes, readHidden, safeCode } from './prompt.mjs';
import { expiryOf, sameSubject, secondsUntilExpired, signatureDifference, tamperSignature } from './token.mjs';

/** A structurally valid but fake JWT; nothing here was ever issued by a real service. */
function fakeJwt(claims, signatureBytes = 32) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = Buffer.from(Array.from({ length: signatureBytes }, (_, index) => (index * 37 + 11) % 256)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.${signature}`;
}
const CODE = { 0: 'OK', 3: 'InvalidArgument', 5: 'NotFound', 7: 'PermissionDenied', 8: 'ResourceExhausted', 14: 'Unavailable', 16: 'Unauthenticated' };
const rpc = (code, rawMessage = '') => rpcFailure({ code, rawMessage }, CODE);
const ok = { transport: 'rpc', status: 'OK', detail: null, rows: null };

describe('token tampering', () => {
  it('changes exactly one decoded signature byte and nothing else', () => {
    for (const bytes of [32, 64]) {
      const token = fakeJwt({ sub: 'user-a', exp: 2_000_000_000 }, bytes);
      const tampered = tamperSignature(token);
      expect(tampered).not.toBe(token);
      expect(tampered.split('.').slice(0, 2)).toEqual(token.split('.').slice(0, 2));
      expect(signatureDifference(token, tampered)).toBe(1);
    }
  });

  it('flips a decoded byte, so the trailing base64url character cannot hide the change', () => {
    const token = fakeJwt({ sub: 'user-a' });
    const last = Buffer.from(token.split('.')[2], 'base64url').length - 1;
    expect(signatureDifference(token, tamperSignature(token, last))).toBe(1);
    expect(signatureDifference(token, tamperSignature(token, 0))).toBe(1);
  });

  it('refuses anything that is not a compact JWT or a byte outside the signature', () => {
    expect(() => tamperSignature('not-a-token')).toThrow();
    expect(() => tamperSignature('a.b.c=')).toThrow();
    expect(() => tamperSignature(fakeJwt({}), 99)).toThrow(RangeError);
    expect(signatureDifference(fakeJwt({ sub: 'a' }), fakeJwt({ sub: 'b' }))).toBeNull();
  });

  it('reads the expiry and waits past it by the skew margin', () => {
    const token = fakeJwt({ sub: 'user-a', exp: 1_000 });
    expect(expiryOf(token)).toBe(1_000);
    expect(secondsUntilExpired(token, 30, 900_000)).toBe(130);
    expect(secondsUntilExpired(token, 30, 2_000_000)).toBe(0);
    expect(expiryOf(fakeJwt({ sub: 'user-a' }))).toBeNull();
  });

  it('compares subjects without exposing them', () => {
    expect(sameSubject(fakeJwt({ sub: 'one' }), fakeJwt({ sub: 'one', exp: 5 }))).toBe(true);
    expect(sameSubject(fakeJwt({ sub: 'one' }), fakeJwt({ sub: 'two' }))).toBe(false);
    expect(sameSubject(fakeJwt({}), fakeJwt({}))).toBe(false);
  });
});

describe('hidden prompt', () => {
  it('handles Enter, Backspace, Ctrl+U and Ctrl+C without echoing', () => {
    expect(applyKeystrokes('', 'secret')).toEqual({ value: 'secret', done: false, aborted: false });
    expect(applyKeystrokes('secret', '\x7f\x7fs\r')).toEqual({ value: 'secrs', done: true, aborted: false });
    expect(applyKeystrokes('abc', '\x15xy\n')).toEqual({ value: 'xy', done: true, aborted: false });
    expect(applyKeystrokes('abc', 'd\x03e')).toEqual({ value: '', done: true, aborted: true });
    expect(applyKeystrokes('', 'ñá\x1b')).toMatchObject({ value: 'ñá' });
  });

  it('refuses a pipe, a file or any input that is not a terminal', async () => {
    const written = [];
    await expect(readHidden('Password: ', { isTTY: false }, { write: (text) => written.push(text) })).rejects.toThrow(/interactive terminal/);
    expect(written).toEqual([]);
  });

  it('reads from a raw terminal and writes only the question and a newline', async () => {
    const input = Object.assign(new EventEmitter(), { isTTY: true, modes: [], setRawMode(mode) { this.modes.push(mode); }, resume() {}, pause() {} });
    const written = [];
    const pending = readHidden('Password: ', input, { write: (text) => written.push(text) });
    input.emit('data', Buffer.from('s3cr'));
    input.emit('data', Buffer.from('et\r'));
    await expect(pending).resolves.toBe('s3cret');
    expect(written.join('')).toBe('Password: \n');
    expect(input.modes).toEqual([true, false]);
  });

  it('prints only stable error codes', () => {
    expect(safeCode({ code: 'invalid_credentials' })).toBe('invalid_credentials');
    expect(safeCode({ code: 'owner@example.test is not confirmed' })).toBe('unknown');
    expect(safeCode(null)).toBe('unknown');
  });
});

describe('arguments and targets', () => {
  const allowed = { '--api': { name: 'api', value: true }, '--skip-expired': { name: 'skipExpired' } };

  it('accepts only documented flags and never echoes a rejected value', () => {
    expect(parseArguments(['--api', 'http://127.0.0.1:5331', '--skip-expired'], allowed)).toEqual({ api: 'http://127.0.0.1:5331', skipExpired: true });
    let message = '';
    try { parseArguments(['--password', 'hunter2-value'], allowed); } catch (error) { message = error.message; }
    expect(message).toMatch(/Argument 1 is not accepted/);
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('--password');
    expect(() => parseArguments(['--api'], allowed)).toThrow(/needs a value/);
  });

  it('treats only loopback hosts as a single local process', () => {
    expect(isLoopback('http://127.0.0.1:5331')).toBe(true);
    expect(isLoopback('http://localhost:5331')).toBe(true);
    expect(isLoopback('http://[::1]:5331')).toBe(true);
    expect(isLoopback('https://api.example.test')).toBe(false);
  });

  it('names check projects within the app limit and recognisably', () => {
    const name = checkProjectName('historial del generador', new Date('2026-11-01T12:00:00Z'));
    expect(name.startsWith(C.projectNamePrefix)).toBe(true);
    expect(name.length).toBeLessThanOrEqual(120);
  });
});

describe('outcomes', () => {
  it('keeps only status, a stable detail and the row count', () => {
    expect(httpOutcome('api-rest', 401, '{"detail":"invalid-token"}')).toEqual({ transport: 'api-rest', status: '401', detail: 'invalid-token', rows: null });
    expect(httpOutcome('supabase', 200, '[]')).toMatchObject({ rows: 0 });
    expect(httpOutcome('supabase', 200, 'null')).toMatchObject({ rows: 0 });
    expect(httpOutcome('supabase', 400, '{"code":"PT404","message":"secret text"}')).toEqual({ transport: 'supabase', status: '400', detail: 'PT404', rows: null });
    expect(httpOutcome('supabase', 403, '{"code":"42501"}').detail).toBe('42501');
    expect(httpOutcome('supabase', 400, '{"code":"MKVLAAG"}').detail).toBeNull();
    expect(httpOutcome('api-rest', 422, '{"detail":[{"input":"MKV"}]}').detail).toBeNull();
    expect(stableDetail('Sequence MKVL is invalid')).toBeNull();
  });

  it('does not mistake a completed delete (204, empty body) for an empty answer', () => {
    expect(classify(httpOutcome('api-rest', 204, ''))).toBe('accepted');
    expect(classify(httpOutcome('supabase', 200, 'null'))).toBe('empty');
    expect(classify(httpOutcome('supabase', 200, '[{"id":"x"}]'))).toBe('accepted');
  });

  it('classifies gRPC, app and REST answers', () => {
    expect(classify(rpc(16, 'invalid-token'))).toBe('unauthenticated');
    expect(classify(rpc(5, 'project-not-found'))).toBe('denied');
    expect(classify(rpc(3, 'validation'))).toBe('refused');
    expect(classify(rpc(8, 'uniprot-rate-limit'))).toBe('rate-limited');
    expect(classify(rpc(14))).toBe('unavailable');
    expect(classify(rpcFailure(new TypeError('fetch failed'), CODE))).toBe('unavailable');
    expect(classify(rpcFailure(Object.assign(new Error('x'), { name: 'ApiError', code: 'session' }), CODE))).toBe('unauthenticated');
    expect(classify(rpcFailure(Object.assign(new Error('x'), { name: 'ApiError', code: 'not-found' }), CODE))).toBe('denied');
    expect(classify({ transport: 'supabase', status: '400', detail: 'PT404', rows: null })).toBe('denied');
    expect(classify({ transport: 'api-rest', status: '409', detail: 'project-conflict', rows: null })).toBe('refused');
    expect(classify({ transport: 'api-rest', status: '503', detail: null, rows: null })).toBe('unavailable');
  });

  it('passes a bad token only when it is refused as unauthenticated', () => {
    expect(expectTokenRejected(rpc(16)).verdict).toBe(VERDICTS.pass);
    expect(expectTokenRejected(httpOutcome('api-rest', 401, '')).verdict).toBe(VERDICTS.pass);
    expect(expectTokenRejected(rpc(3, 'validation')).verdict).toBe(VERDICTS.fail);
    expect(expectTokenRejected(rpc(5)).verdict).toBe(VERDICTS.fail);
    expect(expectTokenRejected(ok).verdict).toBe(VERDICTS.fail);
    expect(expectTokenRejected(rpc(14)).verdict).toBe(VERDICTS.inconclusive);
  });

  it('requires the genuine token to pass authentication in the controls', () => {
    expect(expectTokenAccepted(rpc(3)).verdict).toBe(VERDICTS.pass);
    expect(expectTokenAccepted(rpc(5)).verdict).toBe(VERDICTS.pass);
    expect(expectTokenAccepted(rpc(16)).verdict).toBe(VERDICTS.fail);
    expect(expectTokenAccepted(rpc(14)).verdict).toBe(VERDICTS.inconclusive);
  });

  it('fails isolation on any data or change and never passes an unauthenticated second account', () => {
    expect(expectNoAccess(rpc(5)).verdict).toBe(VERDICTS.pass);
    expect(expectNoAccess(httpOutcome('supabase', 200, '[]')).verdict).toBe(VERDICTS.pass);
    expect(expectNoAccess(httpOutcome('supabase', 200, 'null')).verdict).toBe(VERDICTS.pass);
    expect(expectNoAccess({ transport: 'supabase', status: '400', detail: 'PT404', rows: null }).verdict).toBe(VERDICTS.pass);
    expect(expectNoAccess(httpOutcome('supabase', 200, '[{"id":"x"}]')).verdict).toBe(VERDICTS.fail);
    expect(expectNoAccess(httpOutcome('api-rest', 204, '')).verdict).toBe(VERDICTS.fail);
    expect(expectNoAccess(ok).verdict).toBe(VERDICTS.fail);
    expect(expectNoAccess(rpc(16)).verdict).toBe(VERDICTS.inconclusive);
  });

  it('checks row counts and lets a failed control void the passes that depend on it', () => {
    expect(expectRows(httpOutcome('supabase', 200, '[{"id":"x"}]'), 1).verdict).toBe(VERDICTS.pass);
    expect(expectRows(httpOutcome('supabase', 200, '[]'), 1).verdict).toBe(VERDICTS.fail);
    const pass = { verdict: VERDICTS.pass, observed: 'x' };
    const fail = { verdict: VERDICTS.fail, observed: 'y' };
    expect(dependOn(pass, pass)).toBe(pass);
    expect(dependOn(fail, pass).verdict).toBe(VERDICTS.inconclusive);
    expect(dependOn(fail, fail)).toBe(fail);
  });
});

describe('quota verdict', () => {
  const { limit } = C.quota;
  const options = { limit, windowMs: 60_000, elapsedMs: 20_000, singleProcess: true };
  const counted = Array.from({ length: limit }, () => ok);
  const limited = rpc(8, C.quota.ownBudgetDetail);

  it('passes when exactly the budget is served and the next call meets the API limit', () => {
    expect(evaluateQuota([...counted, limited], options).verdict).toBe(VERDICTS.pass);
    expect(evaluateQuota([...counted, httpOutcome('api-rest', 429, `{"detail":"${C.quota.ownBudgetDetail}"}`)], options).verdict).toBe(VERDICTS.pass);
  });

  it('counts provider failures as spent budget, since the API counts before calling', () => {
    expect(evaluateQuota([rpc(14), ...counted.slice(1), limited], options).verdict).toBe(VERDICTS.pass);
  });

  it('fails a local process that serves past the budget; a deployment is only inconclusive', () => {
    expect(evaluateQuota([...counted, ok], options).verdict).toBe(VERDICTS.fail);
    expect(evaluateQuota([...counted, ok], { ...options, singleProcess: false }).verdict).toBe(VERDICTS.inconclusive);
  });

  it('is inconclusive when the budget was already used, the provider limited, or the window ran out', () => {
    expect(evaluateQuota([...counted.slice(1), limited, limited], options).verdict).toBe(VERDICTS.inconclusive);
    expect(evaluateQuota([...counted, rpc(8, C.quota.providerLimitDetail)], options).verdict).toBe(VERDICTS.inconclusive);
    expect(evaluateQuota([...counted, limited], { ...options, elapsedMs: 60_000 }).verdict).toBe(VERDICTS.inconclusive);
    expect(evaluateQuota([...counted.slice(1), rpc(16), limited], options).verdict).toBe(VERDICTS.inconclusive);
    expect(evaluateQuota(counted, options).verdict).toBe(VERDICTS.inconclusive);
  });
});

describe('report', () => {
  it('renders labels, verdicts and outcome summaries only', () => {
    const token = fakeJwt({ sub: 'user-a', email: 'owner@example.test' });
    const rows = [
      { check: 'tampered token refused: rpc AccountService/GetMe', ...expectTokenRejected(rpc(16, 'invalid-token')) },
      { check: 'B reads the row (Supabase REST)', ...expectNoAccess(httpOutcome('supabase', 200, '[]')) },
    ];
    const table = renderTable(rows);
    expect(table).toContain('PASS');
    expect(table).toContain('rpc Unauthenticated invalid-token');
    expect(table).not.toContain(token.split('.')[2]);
    expect(table).not.toContain('@');
    expect(summary(httpOutcome('supabase', 200, '[]'))).toBe('supabase 200 rows=0');
  });

  it('exits 1 on a failure, 2 when only inconclusive rows remain, 0 otherwise', () => {
    const row = (verdict) => ({ check: 'c', verdict, observed: 'o' });
    expect(exitCode([row(VERDICTS.pass), row(VERDICTS.skipped)])).toBe(0);
    expect(exitCode([row(VERDICTS.pass), row(VERDICTS.inconclusive)])).toBe(2);
    expect(exitCode([row(VERDICTS.inconclusive), row(VERDICTS.fail)])).toBe(1);
  });
});
