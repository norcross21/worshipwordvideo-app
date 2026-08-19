/**
 * The single public contact address for Worship Word Video.
 *
 * Every visitor-facing route — the footer, the legal notice, error recovery, the
 * generated pages, `llms.txt` and the Organization structured data — reads this
 * value, so the published address can only ever be changed in one place.
 *
 * Before changing it, confirm the replacement mailbox actually receives mail.
 * This address is the copyright, correction and content-report route promised in
 * docs/RISK_ASSESSMENT.md, so publishing an address that silently discards mail
 * would remove a control the project depends on.
 *
 * Supabase transactional templates and the administrator directory deliberately
 * keep the operator's own address and are not covered by this constant.
 */
export const PUBLIC_CONTACT_EMAIL = 'stephen@kairoshousing.org.uk';

/** Build a `mailto:` link with a subject that identifies the site. */
export function contactMailto(subject: string): string {
  return `mailto:${PUBLIC_CONTACT_EMAIL}?subject=${encodeURIComponent(`Worship Word Video ${subject}`)}`;
}
