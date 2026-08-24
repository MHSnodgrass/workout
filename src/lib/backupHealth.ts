/**
 * How much training is sitting in this browser and nowhere else.
 *
 * Measured in sessions, not in days. Time since the last export nags after a
 * month away — when there is nothing at risk — and says nothing through a month
 * of hard training, which is exactly backwards. Sessions since the last export
 * is literally the work you would lose.
 */

export const NUDGE_AFTER_SESSIONS = 10;

export function sessionsSinceExport(
  finishedAt: number[],
  lastExportAt: number | null,
): number {
  if (lastExportAt === null) return finishedAt.length;
  return finishedAt.filter((at) => at > lastExportAt).length;
}

export function backupNudge(
  count: number,
  threshold: number = NUDGE_AFTER_SESSIONS,
): string | null {
  if (count < threshold) return null;
  return `${count} workout${count === 1 ? '' : 's'} since your last backup.`;
}
