// The designated collation number results get texted to when an agent
// has no data connection. Must be set per deployment -- there's no
// sensible default, and the composer refuses to build a link without it
// rather than silently opening an SMS to nobody.
const COLLATION_SMS_NUMBER = process.env.NEXT_PUBLIC_SMS_COLLATION_NUMBER ?? "";

export function hasSmsCollationNumber(): boolean {
  return COLLATION_SMS_NUMBER.trim().length > 0;
}

export function buildResultSmsBody(params: {
  puCode: string;
  accreditedVoters: string;
  voteCounts: { candidate: string; votes: string }[];
}): string {
  const parts = [`PU:${params.puCode}`, `ACC:${params.accreditedVoters || "0"}`];
  params.voteCounts
    .filter((r) => r.candidate.trim())
    .forEach((r) => parts.push(`${r.candidate.trim()}:${r.votes || "0"}`));
  return parts.join(" ");
}

/** Builds an `sms:` deep link that opens the device's own SMS app with the
 * message pre-filled -- no telecom/SMS-gateway account needed on our end,
 * the agent reviews and sends it themselves. `?body=` is the modern form
 * that works on both iOS and Android; older `&body=` conventions are no
 * longer necessary on currently-supported OS versions. */
export function buildResultSmsLink(body: string): string {
  return `sms:${COLLATION_SMS_NUMBER}?body=${encodeURIComponent(body)}`;
}
