/**
 * (a) Isolation by project id between two real accounts, run personally by the owner:
 *   node scripts/owner-checks/isolation.mjs [--api <origin>]
 * Account A creates an empty check project; account B tries to read, change and delete it by id
 * through the app's API (gRPC-Web and REST) and the PostgREST paths the API uses; A then verifies
 * it is unchanged and deletes it. Both sign in at a hidden prompt. Prints only the result table.
 */
import { runCheck } from './session.mjs';
import { isolationCheck } from './checks.mjs';

await runCheck('ProteinForge owner check: isolation by project id', {}, isolationCheck);
