/** Local-only rehearsal settings; never changes the deployment or either .env file. */
export const LOCAL_PREDICTION = {
  host: '127.0.0.1', frontendPort: 5330, backendPort: 5331,
  healthPath: '/v1/health', startupTimeoutMs: 20_000, pollIntervalMs: 250,
  requestTimeoutMs: 3_000, enabledValue: 'enabled',
  pythonPaths: { win32: '.venv/Scripts/python.exe', other: '.venv/bin/python' },
};
