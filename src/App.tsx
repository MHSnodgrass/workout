import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import HomeScreen from './screens/HomeScreen';
import LoggingScreen from './screens/LoggingScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import RoutineEditorScreen from './screens/RoutineEditorScreen';
import StatsScreen from './screens/StatsScreen';
import ExerciseStatsScreen from './screens/ExerciseStatsScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <div className="app">
          <main className="content">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/log/:sessionId" element={<LoggingScreen />} />
              <Route path="/routines" element={<RoutinesScreen />} />
              <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/stats/:exerciseId" element={<ExerciseStatsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
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
