const PARENT_PASSWORD = import.meta.env.VITE_PARENT_PASSWORD?.trim() || '085156375515';

export function verifyParentPassword(input: string): boolean {
  return input.trim() === PARENT_PASSWORD;
}
