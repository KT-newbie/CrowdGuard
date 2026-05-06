export function getZoneCapacity(zone: any): number {
  if (zone.capacity) return zone.capacity;
  const zid = zone.id?.toLowerCase() || '';
  if (zid.includes('cat1')) return 1735;
  if (zid.includes('cat2')) return 2025;
  if (zid.includes('cat3')) return 2025;
  if (zid.includes('standing')) return 2500;
  if (zid.includes('cat5')) return 4090;
  if (zid.includes('cat6')) return 1755;
  return 2000;
}
