import { create } from '@bufbuild/protobuf';
import { TimestampSchema } from '@bufbuild/protobuf/wkt';
import type { Timestamp } from '@bufbuild/protobuf/wkt';

const NANOS_DIGITS = 9;
const FRACTION = /\.(\d+)/;

/**
 * Timestamps cross the wire with nanosecond precision. Saved projects use the update time as a
 * concurrency token, so the conversion keeps every digit instead of rounding through Date.
 */
export function isoFromTimestamp(value: Timestamp | undefined): string | null {
  if (!value) return null;
  const whole = new Date(Number(value.seconds) * 1000).toISOString().replace(/\.\d+Z$/, '');
  const fraction = value.nanos ? `.${String(value.nanos).padStart(NANOS_DIGITS, '0').replace(/0+$/, '')}` : '';
  return `${whole}${fraction}Z`;
}

export function timestampFromIso(value: string): Timestamp {
  const milliseconds = Date.parse(value.replace(FRACTION, ''));
  if (!Number.isFinite(milliseconds)) throw new RangeError('Invalid timestamp');
  const digits = FRACTION.exec(value)?.[1] ?? '';
  return create(TimestampSchema, { seconds: BigInt(Math.floor(milliseconds / 1000)), nanos: Number(digits.slice(0, NANOS_DIGITS).padEnd(NANOS_DIGITS, '0')) });
}
