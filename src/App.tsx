import { lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { EditorPage } from './features/editor/EditorPage';
import { SequenceDraftProvider } from './features/editor/SequenceDraftProvider';
import { DEFAULT_EXAMPLE } from './features/editor/examples';
import { AlignmentPage } from './features/alignment/AlignmentPage';
import { AlignmentDraftProvider } from './features/alignment/AlignmentDraftProvider';
import { EXAMPLE_ALIGNMENT_DRAFT } from './features/alignment/examples';
import { LandingPage } from './features/landing/LandingPage';
import { ProjectProvider } from './features/projects/ProjectProvider';
import { GeneratorProvider } from './features/generator/GeneratorProvider';
import { LabProvider } from './features/design-lab/LabProvider';
import { AuthProvider } from './features/auth/AuthProvider';
import { PreferencesProvider } from './preferences/PreferencesProvider';
import { NotFoundPage } from './shared/NotFoundPage';
import { REDIRECTS, ROUTES } from './shared/navigation';
import { PublicFrame } from './shell/PublicFrame';
import { WorkspaceFrame } from './shell/WorkspaceFrame';

const DesignLabPage = lazy(async () => ({ default: (await import('./features/design-lab/DesignLabPage')).DesignLabPage }));
const ProfilePage = lazy(async () => ({ default: (await import('./features/profile/ProfilePage')).ProfilePage }));
const ProjectsPage = lazy(async () => ({ default: (await import('./features/projects/ProjectsPage')).ProjectsPage }));
const LibraryPage = lazy(async () => ({ default: (await import('./features/library/LibraryPage')).LibraryPage }));
const GeneratorPage = lazy(async () => ({ default: (await import('./features/generator/GeneratorPage')).GeneratorPage }));
const GuidePage = lazy(async () => ({ default: (await import('./features/guide/GuidePage')).GuidePage }));
const PrivacyPage = lazy(async () => ({ default: (await import('./features/privacy/PrivacyPage')).PrivacyPage }));
const TermsPage = lazy(async () => ({ default: (await import('./features/legal/TermsPage')).TermsPage }));
const SignInPage = lazy(async () => ({ default: (await import('./features/auth/SignInPage')).SignInPage }));
const SignUpPage = lazy(async () => ({ default: (await import('./features/auth/SignUpPage')).SignUpPage }));
const RecoverPage = lazy(async () => ({ default: (await import('./features/auth/RecoverPage')).RecoverPage }));

/**
 * Two frames share one route tree. Drafts, session and projects live in the providers above it,
 * so moving between the public site and the laboratory never discards work.
 */
function ApplicationRoutes(): React.JSX.Element {
  const location = useLocation();
  const previous = useRef({ path: location.pathname, hash: location.hash });

  useEffect(() => {
    const changedPath = previous.current.path !== location.pathname;
    const changedHash = previous.current.hash !== location.hash;
    previous.current = { path: location.pathname, hash: location.hash };
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && (changedPath || changedHash)) {
      target.scrollIntoView();
      target.focus({ preventScroll: true });
      return;
    }
    if (!changedPath) return;
    window.scrollTo(0, 0);
    document.getElementById('app-content')?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  return (
    <Routes>
      <Route element={<PublicFrame />}>
        <Route path={ROUTES.home} element={<LandingPage />} />
        <Route path={ROUTES.signIn} element={<SignInPage />} />
        <Route path={ROUTES.signUp} element={<SignUpPage />} />
        <Route path={ROUTES.recover} element={<RecoverPage />} />
        <Route path={ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={ROUTES.terms} element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<WorkspaceFrame />}>
        <Route path={ROUTES.analyze} element={<EditorPage />} />
        <Route path={ROUTES.alignment} element={<AlignmentPage />} />
        <Route path={ROUTES.generate} element={<GeneratorPage />} />
        <Route path={ROUTES.laboratory} element={<DesignLabPage />} />
        <Route path={ROUTES.library} element={<LibraryPage />} />
        <Route path={ROUTES.projects} element={<ProjectsPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path={ROUTES.guide} element={<GuidePage />} />
      </Route>
      {REDIRECTS.map((redirect) => <Route key={redirect.from} path={redirect.from} element={<Navigate to={redirect.to} replace />} />)}
    </Routes>
  );
}

export function App(): React.JSX.Element {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <SequenceDraftProvider initial={DEFAULT_EXAMPLE}>
          <AlignmentDraftProvider initial={EXAMPLE_ALIGNMENT_DRAFT}>
            <BrowserRouter>
              <LabProvider><ProjectProvider><GeneratorProvider><ApplicationRoutes /></GeneratorProvider></ProjectProvider></LabProvider>
            </BrowserRouter>
          </AlignmentDraftProvider>
        </SequenceDraftProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;
