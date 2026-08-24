import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { buildBackup, importBackup, validateBackup, type BackupFile } from '../db/backup';
import { getSetting, setSetting } from '../db/settings';
import { formatDate } from '../lib/format';
import { useToast } from '../components/Toast';

export default function SettingsScreen() {
  const toast = useToast();
  const globalRest = useLiveQuery(() => getSetting<number>('globalRestSeconds', 90), []);
  const lastExportAt = useLiveQuery(() => getSetting<number | null>('lastExportAt', null), []);
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
    </div>
  );
}
