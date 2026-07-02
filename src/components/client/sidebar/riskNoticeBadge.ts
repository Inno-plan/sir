export function isRiskNewerThanSeen(
  latestRiskAt?: string | null,
  latestSeenRiskAt?: string | null,
) {
  if (!latestRiskAt) return false;
  if (!latestSeenRiskAt) return true;

  const latestRiskTime = Date.parse(latestRiskAt);
  const latestSeenTime = Date.parse(latestSeenRiskAt);

  if (Number.isNaN(latestRiskTime)) return false;
  if (Number.isNaN(latestSeenTime)) return true;

  return latestRiskTime > latestSeenTime;
}
