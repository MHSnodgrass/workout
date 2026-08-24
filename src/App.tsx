import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dumbbell, ListChecks, Settings, TrendingUp } from 'lucide-react';
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
const BodyWeightScreen = lazy(() => import('./screens/BodyWeightScreen'));

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
                {/* Static segment, so it wins over the :exerciseId route below. */}
                <Route path="/stats/body-weight" element={<BodyWeightScreen />} />
                <Route path="/stats/:exerciseId" element={<ExerciseStatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
              </Routes>
            </Suspense>
          </main>
          <nav className="tabbar">
            <NavLink to="/" end><Dumbbell size={20} /><span>Train</span></NavLink>
            <NavLink to="/routines"><ListChecks size={20} /><span>Routines</span></NavLink>
            <NavLink to="/stats"><TrendingUp size={20} /><span>Stats</span></NavLink>
            <NavLink to="/settings"><Settings size={20} /><span>Settings</span></NavLink>
          </nav>
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
