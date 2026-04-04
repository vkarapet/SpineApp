const PARTICIPANT_ID_REGEX = /^[a-zA-Z0-9]{3,20}$/;

export function validateParticipantId(id: string): { valid: boolean; error?: string } {
  const trimmed = id.trim();
  if (!trimmed) return { valid: false, error: 'Participant ID is required' };
  if (!PARTICIPANT_ID_REGEX.test(trimmed))
    return { valid: false, error: 'Must be 3–20 alphanumeric characters' };
  return { valid: true };
}

export function validateName(name: string, fieldName: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: `${fieldName} is required` };
  if (trimmed.length < 1) return { valid: false, error: `${fieldName} is too short` };
  if (trimmed.length > 100) return { valid: false, error: `${fieldName} is too long` };
  return { valid: true };
}
