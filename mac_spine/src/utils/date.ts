export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return formatDate(isoString);
}

export function daysSince(isoString: string): number {
  const date = new Date(isoString);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function isValidDOB(dob: string): { valid: boolean; error?: string } {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date' };

  const now = new Date();
  if (date > now) return { valid: false, error: 'Date of birth cannot be in the future' };

  const year = date.getFullYear();
  if (year < 1900) return { valid: false, error: 'Date of birth must be after 1900' };

  const age = now.getFullYear() - year;
  const monthDiff = now.getMonth() - date.getMonth();
  const dayDiff = now.getDate() - date.getDate();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

  if (actualAge < 18) return { valid: false, error: 'You must be at least 18 years old' };

  return { valid: true };
}
