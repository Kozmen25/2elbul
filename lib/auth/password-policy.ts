// One password rule for sign-up, password reset and password change.
// Keep in sync with Supabase Auth → password_min_length (see
// scripts/db/apply-auth-config.ts).

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `En az ${MIN_PASSWORD_LENGTH} karakter`;

/** Returns a user-facing error message, or null when the password is acceptable. */
export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
  }
  if (password !== confirmPassword) {
    return "Şifreler birbiriyle eşleşmiyor.";
  }
  return null;
}
