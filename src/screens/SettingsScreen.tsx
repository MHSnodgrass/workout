import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { buildBackup, importBackup, validateBackup, type BackupFile } from '../db/backup';
import { getSetting, setSetting } from '../db/settings';
import { formatDate } from '../lib/format';
import { ensurePersisted, formatBytes, type PersistenceState } from '../lib/persistence';
import { DEFAULT_BAR_LBS, DEFAULT_PLATES } from '../lib/plates';
import { DEFAULT_STALL_SESSIONS } from '../lib/progression';
import { ACCENTS, DEFAULT_ACCENT_ID } from '../lib/theme';
import { notificationPermission, requestNotificationPermission } from '../lib/useRestAlert';
import { useToast } from '../components/Toast';

export default function SettingsScreen() {
  const toast = useToast();
  const globalRest = useLiveQuery(() => getSetting<number>('globalRestSeconds', 90), []);
  const lastExportAt = useLiveQuery(() => getSetting<number | null>('lastExportAt', null), []);
  const keepAwake = useLiveQuery(() => getSetting<boolean>('keepAwake', true), []);
  const trackRir = useLiveQuery(() => getSetting<boolean>('trackRir', false), []);
  const defaultIncrement = useLiveQuery(() => getSetting<number>('defaultIncrementLbs', 5), []);
  const accentId = useLiveQuery(() => getSetting<string>('accent', DEFAULT_ACCENT_ID), []);
  const stallSessions = useLiveQuery(
    () => getSetting<number>('stallSessions', DEFAULT_STALL_SESSIONS),
    [],
  );
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);

  async function doExport() {
    try {
      const backup = await buildBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await setSetting('lastExportAt', Date.now());
      toast('Backup exported');
    } catch {
      toast('Export failed');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = validateBackup(parsed);
      if (!result.ok) {
        toast(`Invalid backup: ${result.error}`);
        return;
      }
      setPendingImport(result.data);
    } catch {
      toast("Couldn't read file — not valid JSON");
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      await importBackup(pendingImport);
      setPendingImport(null);
      toast('Data restored');
    } catch {
      toast('Import failed — existing data unchanged');
    }
  }

  return (
    <div className="screen">
      <h1>Settings</h1>
      <DataSafetyCard />
      <div className="card">
        <strong>Backup</strong>
        <p className="small">
          {lastExportAt ? `Last export: ${formatDate(lastExportAt)}` : 'Never exported'}
        </p>
        <button className="primary" onClick={doExport}>Export data</button>
      </div>
      <div className="card">
        <strong>Restore</strong>
        <p className="small">Importing replaces ALL current data.</p>
        <input type="file" accept="application/json,.json" onChange={onFile} />
        {pendingImport && (
          <div style={{ marginTop: 10 }}>
            <p className="small">
              Backup from {formatDate(pendingImport.exportedAt)}: {pendingImport.sessions.length}{' '}
              sessions, {pendingImport.setLogs.length} sets, {pendingImport.exercises.length}{' '}
              exercises.
            </p>
            <div className="row">
              <button className="danger" onClick={confirmImport}>Replace everything</button>
              <button onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <strong>Accent color</strong>
        <div className="row swatches" style={{ marginTop: 10 }}>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={`swatch${(accentId ?? DEFAULT_ACCENT_ID) === a.id ? ' selected' : ''}`}
              style={{ background: a.value, color: a.ink }}
              aria-label={a.label}
              aria-pressed={(accentId ?? DEFAULT_ACCENT_ID) === a.id}
              onClick={() => void setSetting('accent', a.id)}
            >
              {(accentId ?? DEFAULT_ACCENT_ID) === a.id && <Check size={18} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <strong>During workouts</strong>
        <label className="row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={keepAwake ?? true}
            onChange={(e) => void setSetting('keepAwake', e.target.checked)}
          />
          <span>Keep screen awake</span>
        </label>
        <p className="small">
          Stops the phone locking between sets. Ignored on browsers without the Wake Lock API.
        </p>
        <label className="row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={trackRir ?? false}
            onChange={(e) => void setSetting('trackRir', e.target.checked)}
          />
          <span>Track effort (RIR)</span>
        </label>
        <p className="small">
          Adds a reps-in-reserve field to each set — how many you had left. Never changes the
          weight the app suggests.
        </p>
        <RestAlertSetting />
      </div>
      <div className="card">
        <strong>Rest timer default</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="number"
            value={globalRest ?? 90}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0) void setSetting('globalRestSeconds', n);
            }}
          />
          <span className="small">seconds (default for new exercises)</span>
        </div>
      </div>
      <div className="card">
        <strong>Progression</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            value={defaultIncrement ?? 5}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) void setSetting('defaultIncrementLbs', n);
            }}
          />
          <span className="small">lb added when you top out a rep range</span>
        </div>
        <p className="small">Override per exercise in the Routines tab.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            type="number"
            min={2}
            value={stallSessions ?? DEFAULT_STALL_SESSIONS}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 2) void setSetting('stallSessions', n);
            }}
          />
          <span className="small">sessions stuck before suggesting a deload</span>
        </div>
        <p className="small">
          Drops about 10%, rounded to the exercise's increment. Weighted exercises only.
        </p>
      </div>
      <BarbellCard />
    </div>
  );
}

/**
 * The bar and the rack. These drive the plate breakdown and the warm-up ramp,
 * and only for exercises marked as barbell lifts in the Routines tab.
 */
function BarbellCard() {
  const toast = useToast();
  const bar = useLiveQuery(() => getSetting<number>('barWeightLbs', DEFAULT_BAR_LBS), []);
  const plates = useLiveQuery(() => getSetting<number[]>('availablePlates', DEFAULT_PLATES), []);
  const [draft, setDraft] = useState<string | null>(null);

  async function savePlates(raw: string) {
    const parsed = raw
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (parsed.length === 0) {
      toast('Enter at least one plate weight');
      return;
    }
    await setSetting(
      'availablePlates',
      [...new Set(parsed)].sort((a, b) => b - a),
    );
    setDraft(null);
  }

  return (
    <div className="card">
      <strong>Barbell</strong>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          type="number"
          inputMode="decimal"
          aria-label="Default bar weight in pounds"
          value={bar ?? DEFAULT_BAR_LBS}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) void setSetting('barWeightLbs', n);
          }}
        />
        <span className="small">lb — the bar new barbell lifts assume</span>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input
          aria-label="Plate weights available"
          value={draft ?? (plates ?? DEFAULT_PLATES).join(', ')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => void savePlates(e.target.value)}
        />
      </div>
      <p className="small">
        The plates your gym actually has, heaviest first. Nothing is suggested that you can't
        load — a weight the rack can't build is shown as the nearest one it can.
      </p>
    </div>
  );
}

/**
 * Whether the browser has promised to keep the data. Without persistence,
 * IndexedDB is "best effort" — evictable under storage pressure with no warning
 * and no recovery — which makes this the quiet foundation the whole app rests
 * on, not a nicety.
 */
function DataSafetyCard() {
  const [state, setState] = useState<PersistenceState | 'checking'>('checking');
  const [usage, setUsage] = useState<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    setState(await ensurePersisted(navigator.storage));
    try {
      setUsage((await navigator.storage?.estimate?.())?.usage);
    } catch {
      setUsage(undefined);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="card">
      <strong>Data safety</strong>
      <p className="small">
        {state === 'checking' && 'Checking…'}
        {state === 'persisted' &&
          `Protected — this browser won't evict your data to reclaim space. Using ${formatBytes(usage)}.`}
        {state === 'denied' &&
          'Not protected. The browser may clear this app’s data if the device runs low on space. Installing the app to your home screen usually earns protection.'}
        {state === 'unsupported' &&
          "This browser won't say whether your data is protected. Export regularly."}
      </p>
      {state === 'denied' && (
        <button onClick={() => void refresh()}>Ask again</button>
      )}
      <p className="small">Either way, an exported backup is the only copy that survives this device.</p>
    </div>
  );
}

/**
 * Deliberately blunt copy. This works while you're in another app; it does not
 * survive a locked phone for long, and promising otherwise would get someone
 * stuck under a bar waiting for a buzz that isn't coming.
 */
function RestAlertSetting() {
  const toast = useToast();
  const enabled = useLiveQuery(() => getSetting<boolean>('restAlert', false), []);
  const [permission, setPermission] = useState(notificationPermission);

  async function toggle(next: boolean) {
    if (!next) {
      await setSetting('restAlert', false);
      return;
    }
    // Asked on a tap, and only the first time — never on load.
    const result = permission === 'granted' ? permission : await requestNotificationPermission();
    setPermission(result);
    if (result !== 'granted') {
      toast(
        result === 'unsupported'
          ? "This browser can't show notifications"
          : 'Notifications are blocked — allow them in your browser settings',
      );
      return;
    }
    await setSetting('restAlert', true);
  }

  return (
    <>
      <label className="row" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={enabled === true && permission === 'granted'}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span>Buzz when rest ends</span>
      </label>
      <p className="small">
        Sends a notification if you've switched to another app. It won't reliably reach you once
        the phone has been locked for a few minutes — browsers stop background timers, and there's
        no server here to wake the app. Don't count on it before a heavy set.
      </p>
      {enabled === true && permission === 'denied' && (
        <p className="small">
          Notifications are blocked for this site. Allow them in your browser settings and toggle
          this again.
        </p>
      )}
    </>
  );
}

