import { z } from 'zod';
import { EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH, TOTP_CODE_LENGTH, TOTP_FACTOR_NAME_MAX_LENGTH } from './config';
import type { TranslationKey } from '../../i18n/translate';

/** Field-level rules; each failure maps to a catalog key so the message is translated at render time. */
export const emailSchema = z.string().trim().min(1, 'auth.errorEmailRequired').max(EMAIL_MAX_LENGTH, 'auth.errorEmailInvalid')
  .refine((value) => z.email().safeParse(value).success, { message: 'auth.errorEmailInvalid' });
export const passwordSchema = z.string().min(1, 'auth.errorPasswordRequired').min(PASSWORD_MIN_LENGTH, 'auth.errorPasswordShort');

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'auth.errorPasswordRequired') });
export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { message: 'auth.errorPasswordMismatch', path: ['confirm'] });
export const recoverSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { message: 'auth.errorPasswordMismatch', path: ['confirm'] });

/** Authenticator apps often show the code in two groups; spaces are dropped before checking the digits. */
export function normalizeTotpCode(value: string): string {
  return value.replace(/\s+/g, '');
}

const totpCodePattern = new RegExp(`^[0-9]{${String(TOTP_CODE_LENGTH)}}$`);
export const totpCodeSchema = z.string().transform(normalizeTotpCode)
  .pipe(z.string().min(1, 'auth.errorTotpCodeRequired').regex(totpCodePattern, 'auth.errorTotpCodeDigits'));
export const factorNameSchema = z.string().trim().min(1, 'auth.errorFactorNameRequired').max(TOTP_FACTOR_NAME_MAX_LENGTH, 'auth.errorFactorNameLong');

export type FieldErrors<Field extends string> = Partial<Record<Field, TranslationKey>>;

/** Returns the first catalog key per field, or an empty object when the values are valid. */
export function fieldErrors<Field extends string>(result: z.ZodSafeParseResult<unknown>): FieldErrors<Field> {
  if (result.success) return {};
  const errors: FieldErrors<Field> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) errors[field as Field] = issue.message as TranslationKey;
  }
  return errors;
}
