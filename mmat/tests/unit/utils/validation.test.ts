import { describe, it, expect } from 'vitest';
import { validateParticipantId, validateName } from '../../../src/utils/validation';

describe('validateParticipantId', () => {
  it('should accept valid alphanumeric ID', () => {
    expect(validateParticipantId('ABC123')).toEqual({ valid: true });
  });

  it('should accept 3-char minimum', () => {
    expect(validateParticipantId('abc')).toEqual({ valid: true });
  });

  it('should accept 20-char maximum', () => {
    expect(validateParticipantId('a'.repeat(20))).toEqual({ valid: true });
  });

  it('should reject empty ID', () => {
    expect(validateParticipantId('')).toEqual({
      valid: false,
      error: 'Participant ID is required',
    });
  });

  it('should reject too short ID', () => {
    expect(validateParticipantId('ab')).toEqual({
      valid: false,
      error: 'Must be 3–20 alphanumeric characters',
    });
  });

  it('should reject too long ID', () => {
    expect(validateParticipantId('a'.repeat(21))).toEqual({
      valid: false,
      error: 'Must be 3–20 alphanumeric characters',
    });
  });

  it('should reject special characters', () => {
    expect(validateParticipantId('ABC-123')).toEqual({
      valid: false,
      error: 'Must be 3–20 alphanumeric characters',
    });
  });

  it('should reject spaces', () => {
    expect(validateParticipantId('ABC 123')).toEqual({
      valid: false,
      error: 'Must be 3–20 alphanumeric characters',
    });
  });

  it('should trim whitespace before validating', () => {
    expect(validateParticipantId('  ABC123  ')).toEqual({ valid: true });
  });
});

describe('validateName', () => {
  it('should accept valid name', () => {
    expect(validateName('John', 'First name')).toEqual({ valid: true });
  });

  it('should reject empty name', () => {
    expect(validateName('', 'First name')).toEqual({
      valid: false,
      error: 'First name is required',
    });
  });

  it('should reject name that is too long', () => {
    const longName = 'a'.repeat(101);
    expect(validateName(longName, 'First name')).toEqual({
      valid: false,
      error: 'First name is too long',
    });
  });
});
