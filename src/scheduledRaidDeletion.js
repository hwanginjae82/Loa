export function canDeleteScheduledRaid(raid, now = new Date()) {
  if (!raid?.startsAt) return true;

  const startTime = new Date(raid.startsAt).getTime();
  return Number.isFinite(startTime) && startTime > new Date(now).getTime();
}

export function removeScheduledRaid(raids, raidId, now = new Date()) {
  const raid = raids.find((item) => item.id === raidId);
  if (!raid) return raids;
  if (!canDeleteScheduledRaid(raid, now)) throw new Error("Scheduled raid has already started");

  return raids.filter((item) => item.id !== raidId);
}
