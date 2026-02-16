import { describe, it, expect } from 'vitest';
import { validateEmail, validateName, validateDOB } from '../../../src/utils/validation';

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('test@example.com')).toEqual({ valid: true });
  });

  it('should reject empty email', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
  });

  it('should reject invalid email', () => {
    expect(validateEmail('notanemail')).toEqual({
      valid: false,
      error: 'Please enter a valid email address',
    });
  });

  it('should reject email without domain', () => {
    expect(validateEmail('test@')).toEqual({
      valid: false,
      error: 'Please enter a valid email address',
    });
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

describe('validateDOB', () => {
  it('should accept valid adult DOB', () => {
    expect(validateDOB('1990-01-01')).toEqual({ valid: true });
  });

  it('should reject empty DOB', () => {
    expect(validateDOB('')).toEqual({ valid: false, error: 'Date of birth is required' });
  });

  it('should reject future date', () => {
    expect(validateDOB('2099-01-01')).toEqual({
      valid: false,
      error: 'Date of birth cannot be in the future',
    });
  });

  it('should reject under 18', () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 10);
    expect(validateDOB(recent.toISOString().split('T')[0])).toEqual({
      valid: false,
      error: 'This app is intended for adults aged 18 and older',
    });
  });

  it('should reject dates before 1900', () => {
    expect(validateDOB('1899-12-31')).toEqual({
      valid: false,
      error: 'Please enter a valid date of birth',
    });
  });
});
