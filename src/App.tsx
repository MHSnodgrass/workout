import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dumbbell, ListChecks, Settings, TrendingUp } from 'lucide-react';
import { getSetting } from './db/settings';
import { retryChunk } from './lib/chunkRetry';
import { DEFAULT_ACCENT_ID, applyAccent, resolveAccent } from './lib/theme';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { ToastProvider } from './components/Toast';
import HomeScreen from './screens/HomeScreen';
import LoggingScreen from './screens/LoggingScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import RoutineEditorScreen from './screens/RoutineEditorScreen';
import SettingsScreen from './screens/SettingsScreen';

// Split out so the charting library isn't in the download you wait on at the
// gym — the logging path never touches it.
//
// Wrapped in retryChunk because these are fetched long after the page loaded:
// a deploy in between deletes the file this build is asking for, and the 404
// would otherwise unmount the whole app. See lib/chunkRetry.ts.
const StatsScreen = lazy(() => retryChunk(() => import('./screens/StatsScreen')));
const ExerciseStatsScreen = lazy(() => retryChunk(() => import('./screens/ExerciseStatsScreen')));
const BodyWeightScreen = lazy(() => retryChunk(() => import('./screens/BodyWeightScreen')));

export default function App() {
  const accentId = useLiveQuery(() => getSetting<string>('accent', DEFAULT_ACCENT_ID), []);
  useEffect(() => {
    applyAccent(resolveAccent(accentId), document.documentElement);
  }, [accentId]);

  return (
    <HashRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  );
}

/** Inside the router, so the error boundary can reset itself per route. */
function Shell() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <main className="content">
        {/* Keyed on the route: without this, one screen that failed would stay
            failed for the rest of the session, even after navigating away. */}
        <RouteErrorBoundary key={pathname}>
          <Suspense fallback={<div className="screen">Loading…</div>}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/log/:sessionId" element={<LoggingScreen />} />
              <Route path="/routines" element={<RoutinesScreen />} />
              <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              {/* Static segment, so it wins over the :exerciseId route below. */}
              <Route path="/stats/body-weight" element={<BodyWeightScreen />} />
              <Route path="/stats/:exerciseId" element={<ExerciseStatsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      {/* Outside the boundary: whatever broke, there is always a way out. */}
      <nav className="tabbar">
        <NavLink to="/" end><Dumbbell size={20} /><span>Train</span></NavLink>
        <NavLink to="/routines"><ListChecks size={20} /><span>Routines</span></NavLink>
        <NavLink to="/stats"><TrendingUp size={20} /><span>Stats</span></NavLink>
        <NavLink to="/settings"><Settings size={20} /><span>Settings</span></NavLink>
      </nav>
    </div>
  );
}
