# Worship Word Video email delivery

Status on 9 August 2026: the Resend compliance information has been submitted and email delivery must remain off until Resend approves the account.

## Prepared structure

- Sender: `Stephen at Kairos Housing <Stephen@kairoshousing.org.uk>`
- Organisation: Kairos Housing — Rebuilding lives with dignity
- Recipient signup website: `https://www.worshipwordvideo.org/`
- Charity website: `https://www.kairoshousing.org.uk/`
- Donation page: `https://operations.kairoshousing.org.uk/donate`
- Transactional messages: confirmation, administrator invitation and password recovery
- Administrator: only the verified `stephen@kairoshousing.org.uk` master account can invite a member
- Consent: an invitation never records Kairos marketing consent; the member makes that optional choice after accepting the invitation

## Activate only after approval

1. In Resend, verify the `kairoshousing.org.uk` sending domain and wait for every required DNS record to show as verified.
2. Create a Resend API key for Supabase transactional email. Keep the key secret.
3. Confirm that the Supabase Auth URL allowlist contains both `https://www.worshipwordvideo.org/**` and `https://worshipwordvideo.org/**`.
4. Supply `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` and `RESEND_SMTP_PASSWORD` in a private terminal session. Preview the operation with `npm run email:configure`, then apply it once with `npm run email:configure:apply`.
5. Add server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Vercel Production environment. Add them to Preview only when invitation testing is needed. Never prefix the secret with `VITE_`.
6. Redeploy, sign in as Stephen, and send the first invitation only to an address Stephen controls.

The activation script configures Resend SMTP at `smtp.resend.com` on port `465`, installs the reviewed Supabase templates and does not print secret values.

## Acceptance checks

1. A guest can still browse the catalogue without registering.
2. Only Stephen sees the administrator invitation form.
3. A non-administrator request to the invitation endpoint returns an access error.
4. An invited member receives the branded email, opens the secure link and chooses their own password.
5. After the password is saved, the account screen requires the member to accept the terms and separately choose whether to receive occasional Kairos news and appeals.
6. A password-reset email returns to the new-password screen.
7. Confirmation, invitation and recovery links all open on `www.worshipwordvideo.org`.

## Email safety rules

- Invite only people who asked to join or otherwise expect the invitation. Do not use the account invitation as a bulk mailing list.
- Essential account emails and optional Kairos updates remain separate.
- Never treat registration or an administrator invitation as consent to charity marketing.
- Any future Kairos update or fundraising email must be sent only to current opt-ins, identify Kairos Housing, include an unsubscribe route and honour opt-outs promptly.
- Do not upload or export member email addresses to another mailing service without a documented purpose and appropriate protection.
