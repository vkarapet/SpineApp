/**
 * Compute age in completed years from an ISO date-of-birth string (YYYY-MM-DD).
 * Returns null if the input is missing or unparseable.
 */
export function computeAge(dob: string | undefined | null, on: Date = new Date()): number | null {
  if (!dob) return null;
  const parts = dob.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  let age = on.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    on.getMonth() < birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}
