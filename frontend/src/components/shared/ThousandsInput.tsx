"use client";

import { Input } from "@/components/ui/input";
import { formatThousands, parseThousands } from "@/lib/format/thousands";

/** A vote-count/accreditation-figure input that shows "12,400" as you
 * type instead of a bare "12400" -- a six-figure number read at a glance
 * versus counted digit by digit is the difference between someone
 * trusting the form and someone re-typing it into a calculator to check.
 * `value`/`onChange` still carry the plain digit string underneath;
 * only the display is formatted. */
export function ThousandsInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (digits: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={formatThousands(value)}
      onChange={(e) => onChange(parseThousands(e.target.value))}
      {...props}
    />
  );
}
