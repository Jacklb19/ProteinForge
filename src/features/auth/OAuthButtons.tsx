import { useTranslation } from '../../i18n';
import { PROVIDER_MARKS } from '../../shared/designAssets';
import { useAuth } from './authContext';
import { OAUTH_PROVIDERS } from './config';
import { rememberDestination } from './destination';

/** «o» and one button per provider; the requested page is kept for the return from the provider. */
export function OAuthButtons({ destination }: { destination: string | null }): React.JSX.Element | null {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status === 'disabled' || OAUTH_PROVIDERS.length === 0) return null;
  return (
    <div className="auth-providers">
      <span className="auth-divider" aria-hidden="true">{t('auth.or')}</span>
      {OAUTH_PROVIDERS.map((provider) => {
        const url = auth.authorizeUrl(provider.id);
        return url ? <a key={provider.id} className="button button-secondary button-large button-wide" href={url} onClick={() => { rememberDestination(destination); }}>
          <img className="provider-mark" src={PROVIDER_MARKS[provider.id]} alt="" aria-hidden="true" />{t(provider.labelKey)}
        </a> : null;
      })}
    </div>
  );
}
