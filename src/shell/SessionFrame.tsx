import { useAuth } from '../features/auth/authContext';
import { PublicFrame } from './PublicFrame';
import { WorkspaceFrame } from './WorkspaceFrame';

/** Pages readable without an account: inside the laboratory with a session, on the public site without one. */
export function SessionFrame(): React.JSX.Element {
  const { status } = useAuth();
  return status === 'signed-in' || status === 'loading' ? <WorkspaceFrame /> : <PublicFrame />;
}
