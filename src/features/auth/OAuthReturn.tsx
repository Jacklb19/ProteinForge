import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { takeRememberedDestination } from './destination';

/** Google returns to the registered address; from there the visitor continues to the page they asked for. */
export function OAuthReturn(): React.JSX.Element {
  const [destination] = useState(takeRememberedDestination);
  return <Navigate to={destination} replace />;
}
