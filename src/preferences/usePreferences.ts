import { useContext } from 'react';
import { PreferencesContext } from './preferencesContext';

/** Returns the current preferences and their update functions. */
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is required.');
  return context;
}
