const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['\b', '\x7f']);
const INTERRUPT = '\x03';
const END_OF_INPUT = '\x04';
const CLEAR_LINE = '\x15';

/**
 * Applies typed characters to the hidden buffer. Pure, so the prompt's handling of Enter, Backspace,
 * Ctrl+U and Ctrl+C can be tested without a terminal.
 */
export function applyKeystrokes(value, chunk) {
  let next = value;
  for (const character of chunk) {
    if (character === INTERRUPT) return { value: '', done: true, aborted: true };
    if (ENTER.has(character) || character === END_OF_INPUT) return { value: next, done: true, aborted: false };
    if (BACKSPACE.has(character)) next = [...next].slice(0, -1).join('');
    else if (character === CLEAR_LINE) next = '';
    else if (character >= ' ') next += character;
  }
  return { value: next, done: false, aborted: false };
}

/**
 * Reads one line without echoing it. Refuses anything but an interactive terminal, so credentials
 * cannot arrive from a pipe, a file or an environment variable.
 */
export function readHidden(question, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this check in an interactive terminal; credentials are only read from a hidden prompt.'));
  }
  output.write(question);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (result) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (result.aborted) reject(new Error('Cancelled at the prompt.'));
      else resolve(result.value);
    };
    const onData = (data) => {
      const result = applyKeystrokes(value, data.toString('utf8'));
      value = result.value;
      if (result.done) finish(result);
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

/** Signs in with the app's Supabase Auth client; email and password exist only inside this call. */
export async function signInHidden(authApi, label) {
  const email = (await readHidden(`${label} — email (hidden): `)).trim();
  const password = await readHidden(`${label} — password (hidden): `);
  if (!email || !password) throw new Error(`${label}: email and password are both required.`);
  try {
    return await authApi.signIn(email, password);
  } catch (error) {
    // Only the stable Supabase code; its message could quote the submitted address.
    throw new Error(`${label}: sign-in refused (${safeCode(error)}).`);
  }
}

/** A printable stable error code, or a neutral word when the value does not look like one. */
export function safeCode(error) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return /^[a-z0-9_-]{1,64}$/i.test(code) ? code : 'unknown';
}
