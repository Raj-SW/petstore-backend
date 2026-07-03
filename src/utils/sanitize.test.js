const { toSafeString, escapeRegExp, sanitizeForLog } = require('./sanitize');

describe('toSafeString', () => {
  it('returns a plain string unchanged', () => {
    expect(toSafeString('abc123')).toBe('abc123');
  });

  it('coerces numbers and booleans to strings', () => {
    expect(toSafeString(42)).toBe('42');
    expect(toSafeString(true)).toBe('true');
  });

  it('rejects objects (NoSQL operator-injection vector) by returning undefined', () => {
    expect(toSafeString({ $ne: null })).toBeUndefined();
    expect(toSafeString({ $gt: '' })).toBeUndefined();
  });

  it('rejects arrays by returning undefined', () => {
    expect(toSafeString(['a', 'b'])).toBeUndefined();
  });

  it('returns undefined for null and undefined', () => {
    expect(toSafeString(null)).toBeUndefined();
    expect(toSafeString(undefined)).toBeUndefined();
  });
});

describe('escapeRegExp', () => {
  it('leaves a plain alphanumeric string unchanged', () => {
    expect(escapeRegExp('Labrador')).toBe('Labrador');
  });

  it('escapes regex metacharacters so user input cannot inject a pattern', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegExp('(x)[y]{z}')).toBe('\\(x\\)\\[y\\]\\{z\\}');
  });

  it('neutralizes a catastrophic-backtracking ReDoS payload by escaping it', () => {
    // '(a+)+$' would be dangerous if used as a pattern; escaped it is literal
    expect(escapeRegExp('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
  });

  it('coerces non-string input to a string before escaping', () => {
    expect(escapeRegExp(42)).toBe('42');
  });

  it('returns an empty string for null or undefined', () => {
    expect(escapeRegExp(null)).toBe('');
    expect(escapeRegExp(undefined)).toBe('');
  });
});

describe('sanitizeForLog', () => {
  it('leaves a clean string unchanged', () => {
    expect(sanitizeForLog('SUMMER10')).toBe('SUMMER10');
  });

  it('keeps normal spaces', () => {
    expect(sanitizeForLog('hi there friend')).toBe('hi there friend');
  });

  it('strips CR and LF so user input cannot forge new log lines', () => {
    expect(sanitizeForLog('code\r\nINFO fake admin login')).toBe('codeINFO fake admin login');
    expect(sanitizeForLog('a\nb')).toBe('ab');
  });

  it('coerces non-strings and returns empty for null/undefined', () => {
    expect(sanitizeForLog(42)).toBe('42');
    expect(sanitizeForLog(null)).toBe('');
    expect(sanitizeForLog(undefined)).toBe('');
  });
});
