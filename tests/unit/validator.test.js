const { validateContactForm, validateLoginForm } = require('../../public/js/validator');

describe('validateContactForm', () => {
  test('accepts valid name and email', () => {
    const result = validateContactForm('Alice', 'alice@example.com');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects empty name', () => {
    const result = validateContactForm('', 'alice@example.com');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /name/i.test(e))).toBe(true);
  });

  test('rejects whitespace-only name', () => {
    const result = validateContactForm('   ', 'alice@example.com');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /name/i.test(e))).toBe(true);
  });

  test('rejects invalid email', () => {
    const result = validateContactForm('Alice', 'not-an-email');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('rejects empty email', () => {
    const result = validateContactForm('Alice', '');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /email/i.test(e))).toBe(true);
  });

  test('rejects both empty fields', () => {
    const result = validateContactForm('', '');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('validateLoginForm', () => {
  test('accepts valid registration number and password', () => {
    const result = validateLoginForm('STU/2024/001', 'secret123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects empty registration number', () => {
    const result = validateLoginForm('', 'secret123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /registration number/i.test(e))).toBe(true);
  });

  test('rejects whitespace-only registration number', () => {
    const result = validateLoginForm('   ', 'secret123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /registration number/i.test(e))).toBe(true);
  });

  test('rejects empty password', () => {
    const result = validateLoginForm('alice', '');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /password/i.test(e))).toBe(true);
  });

  test('rejects whitespace-only password', () => {
    const result = validateLoginForm('alice', '\t');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /password/i.test(e))).toBe(true);
  });

  test('rejects both empty fields', () => {
    const result = validateLoginForm('', '');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
