import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from './db/settings';
import { DEFAULT_ACCENT_ID, applyAccent, resolveAccent } from './lib/theme';
import { ToastProvider } from './components/Toast';
import HomeScreen from './screens/HomeScreen';
import LoggingScreen from './screens/LoggingScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import RoutineEditorScreen from './screens/RoutineEditorScreen';
import SettingsScreen from './screens/SettingsScreen';

// Split out so the charting library isn't in the download you wait on at the
// gym — the logging path never touches it.
const StatsScreen = lazy(() => import('./screens/StatsScreen'));
const ExerciseStatsScreen = lazy(() => import('./screens/ExerciseStatsScreen'));

export default function App() {
  const accentId = useLiveQuery(() => getSetting<string>('accent', DEFAULT_ACCENT_ID), []);
  useEffect(() => {
    applyAccent(resolveAccent(accentId), document.documentElement);
  }, [accentId]);

  return (
    <HashRouter>
      <ToastProvider>
        <div className="app">
          <main className="content">
            <Suspense fallback={<div className="screen">Loading…</div>}>
              <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/log/:sessionId" element={<LoggingScreen />} />
                <Route path="/routines" element={<RoutinesScreen />} />
                <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
                <Route path="/stats" element={<StatsScreen />} />
                <Route path="/stats/:exerciseId" element={<ExerciseStatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
              </Routes>
            </Suspense>
          </main>
          <nav className="tabbar">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/routines">Routines</NavLink>
            <NavLink to="/stats">Stats</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
