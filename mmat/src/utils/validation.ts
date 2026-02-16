const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, error: 'Please enter a valid email address' };
  return { valid: true };
}

export function validateName(name: string, fieldName: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: `${fieldName} is required` };
  if (trimmed.length < 1) return { valid: false, error: `${fieldName} is too short` };
  if (trimmed.length > 100) return { valid: false, error: `${fieldName} is too long` };
  return { valid: true };
}

export function validateDOB(dob: string): { valid: boolean; error?: string } {
  if (!dob) return { valid: false, error: 'Date of birth is required' };

  const date = new Date(dob);
  if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date' };

  const now = new Date();
  if (date > now) return { valid: false, error: 'Date of birth cannot be in the future' };

  const year = date.getFullYear();
  if (year < 1900) return { valid: false, error: 'Please enter a valid date of birth' };

  // Age check
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() - date.getMonth();
  const dayDiff = now.getDate() - date.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;

  if (age < 18) {
    return { valid: false, error: 'This app is intended for adults aged 18 and older' };
  }

  return { valid: true };
}
