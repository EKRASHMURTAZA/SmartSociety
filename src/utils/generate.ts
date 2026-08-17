export function generateFourDigitCode(): string {
  const values = new Uint32Array(1);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
    return String(1000 + (values[0] % 9000));
  }

  return String(1000 + Math.floor(Math.random() * 9000));
}

export function generateReference(prefix: string): string {
  const values = new Uint32Array(1);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
    return `${prefix}-${Date.now()}-${values[0].toString(36)}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
