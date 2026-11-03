/**
 * (c) Generator history with a real session, run personally by the owner:
 *   node scripts/owner-checks/generator-history.mjs [--api <origin>]
 * Runs the app's default candidate search locally, saves it to a new check project the way the
 * generator's «save to project» does, checks the count in the project list, reopens and verifies
 * it, then deletes the project. Sequences stay in memory; prints only the result table.
 */
import { runCheck } from './session.mjs';
import { generatorHistoryCheck } from './checks.mjs';

await runCheck('ProteinForge owner check: generator history', {}, generatorHistoryCheck);
