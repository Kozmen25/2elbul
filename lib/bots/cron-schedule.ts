const SCHEDULE_INTERVAL_MS: Record<string, number> = {
  "0 * * * *": 60 * 60 * 1000,
  "0 */3 * * *": 3 * 60 * 60 * 1000,
  "0 */6 * * *": 6 * 60 * 60 * 1000,
  "0 */12 * * *": 12 * 60 * 60 * 1000,
  "0 3 * * *": 24 * 60 * 60 * 1000,
};

const DEFAULT_INTERVAL_MS = SCHEDULE_INTERVAL_MS["0 */6 * * *"]!;

export function getScheduleIntervalMs(cronSchedule: string) {
  return SCHEDULE_INTERVAL_MS[cronSchedule.trim()] ?? DEFAULT_INTERVAL_MS;
}

export function isSourceDueForRun(
  cronSchedule: string,
  lastRunAt: string | null | undefined,
) {
  if (!lastRunAt) return true;
  const lastRun = new Date(lastRunAt).getTime();
  if (!Number.isFinite(lastRun)) return true;
  return Date.now() - lastRun >= getScheduleIntervalMs(cronSchedule);
}
