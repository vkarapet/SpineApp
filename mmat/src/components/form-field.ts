import { createElement } from '../utils/dom';

export interface FormFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'email' | 'date';
  inputMode?: string;
  autocapitalize?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  readOnly?: boolean;
  validate?: (value: string) => { valid: boolean; error?: string };
  onChange?: (value: string, valid: boolean) => void;
}

export interface FormFieldRef {
  container: HTMLDivElement;
  input: HTMLInputElement;
  getValue: () => string;
  isValid: () => boolean;
  showError: (msg: string) => void;
  clearError: () => void;
}

export function createFormField(config: FormFieldConfig): FormFieldRef {
  const {
    id,
    label,
    type,
    inputMode,
    autocapitalize,
    required = false,
    placeholder,
    value,
    readOnly = false,
    validate,
    onChange,
  } = config;

  const container = createElement('div', { className: 'form-field' });

  const labelEl = createElement('label', {
    className: 'form-field__label',
    textContent: label,
  });
  labelEl.setAttribute('for', id);

  const input = createElement('input', {
    id,
    className: 'form-field__input',
    type,
  });

  if (inputMode) input.setAttribute('inputmode', inputMode);
  if (autocapitalize) input.setAttribute('autocapitalize', autocapitalize);
  if (required) input.required = true;
  if (placeholder) input.placeholder = placeholder;
  if (value) input.value = value;
  if (readOnly) {
    input.readOnly = true;
    container.classList.add('form-field--readonly');
  }

  const errorEl = createElement('div', {
    className: 'form-field__error',
    'aria-live': 'polite',
  });

  let isFieldValid = !required;

  container.appendChild(labelEl);
  container.appendChild(input);
  container.appendChild(errorEl);

  const doValidation = () => {
    if (!validate) {
      isFieldValid = true;
      return;
    }
    const result = validate(input.value);
    isFieldValid = result.valid;
    if (result.valid) {
      errorEl.textContent = '';
      input.classList.remove('form-field__input--error');
    } else {
      errorEl.textContent = result.error ?? 'Invalid';
      input.classList.add('form-field__input--error');
    }
    onChange?.(input.value, isFieldValid);
  };

  input.addEventListener('blur', doValidation);
  input.addEventListener('input', () => {
    // Clear error on input, validate on blur
    if (errorEl.textContent) {
      errorEl.textContent = '';
      input.classList.remove('form-field__input--error');
    }
    onChange?.(input.value, isFieldValid);
  });

  return {
    container,
    input,
    getValue: () => input.value,
    isValid: () => {
      doValidation();
      return isFieldValid;
    },
    showError: (msg: string) => {
      errorEl.textContent = msg;
      input.classList.add('form-field__input--error');
      isFieldValid = false;
    },
    clearError: () => {
      errorEl.textContent = '';
      input.classList.remove('form-field__input--error');
    },
  };
}

// Inject form field styles
const style = document.createElement('style');
style.textContent = `
  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .form-field + .form-field {
    margin-top: var(--space-4);
  }
  .form-field__label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
  }
  .form-field__input {
    min-height: var(--tap-target-min);
    padding: var(--space-3) var(--space-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    background: var(--color-bg);
    transition: border-color var(--transition-fast);
    width: 100%;
  }
  .form-field__input:focus {
    border-color: var(--color-border-focus);
    outline: none;
  }
  .form-field__input--error {
    border-color: var(--color-error);
  }
  .form-field__error {
    font-size: var(--font-size-sm);
    color: var(--color-error);
    min-height: 1.25rem;
  }
  .form-field--readonly .form-field__input {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: default;
  }
`;
document.head.appendChild(style);
