import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateId(length: number): string {
  if (length <= 0) {
    throw new Error('Length must be greater than zero');
  }

  let id = '';
  const alphabetLength = ALPHABET.length;

  for (let i = 0; i < length; i++) {
    const index = randomInt(alphabetLength);
    id += ALPHABET[index];
  }

  return id;
}
