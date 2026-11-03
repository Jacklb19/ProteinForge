/**
 * (b) Reference quota and refused tokens, run personally by the owner:
 *   node scripts/owner-checks/gateway.mjs [--api <origin>] [--skip-expired]
 * Signs in at a hidden prompt; the token stays in memory. Prints only the result table.
 */
import { runCheck } from './session.mjs';
import { gatewayCheck } from './checks.mjs';

await runCheck('ProteinForge owner check: quota and refused tokens', { '--skip-expired': { name: 'skipExpired' } }, gatewayCheck);
