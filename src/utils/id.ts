import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateId(length: number): string {
  if (length <= 0) {
    throw new Error('Length must be greater than zero');
  }

  const bytes = randomBytes(length);
  let id = '';

  for (let i = 0; i < length; i++) {
    const index = bytes[i] % ALPHABET.length;
    id += ALPHABET[index];
  }

  return id;
}
