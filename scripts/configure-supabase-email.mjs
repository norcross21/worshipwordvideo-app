import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apply = process.argv.includes('--apply');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const templateFiles = {
  confirmation: path.join(root, 'supabase/templates/confirmation.html'),
  invite: path.join(root, 'supabase/templates/invite.html'),
  recovery: path.join(root, 'supabase/templates/recovery.html'),
};

const templates = Object.fromEntries(await Promise.all(
  Object.entries(templateFiles).map(async ([name, filename]) => [name, await readFile(filename, 'utf8')]),
));

const requirements = {
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
  RESEND_SMTP_PASSWORD: process.env.RESEND_SMTP_PASSWORD,
};

if (!apply) {
  console.log('Worship Word Video email activation plan (no changes made)');
  console.log('Sender: Stephen at Kairos Housing <Stephen@kairoshousing.org.uk>');
  console.log('SMTP: smtp.resend.com:465 using implicit TLS');
  console.log(`Templates ready: ${Object.keys(templates).join(', ')}`);
  for (const [name, value] of Object.entries(requirements)) {
    console.log(`${name}: ${value ? 'available' : 'missing'}`);
  }
  console.log('After Resend approval and domain verification, set the missing values and run npm run email:configure:apply.');
  process.exit(0);
}

const missing = Object.entries(requirements).filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  throw new Error(`Email configuration was not changed. Missing: ${missing.join(', ')}`);
}

const endpoint = `https://api.supabase.com/v1/projects/${encodeURIComponent(requirements.SUPABASE_PROJECT_REF)}/config/auth`;
const response = await fetch(endpoint, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${requirements.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    smtp_admin_email: 'Stephen@kairoshousing.org.uk',
    smtp_host: 'smtp.resend.com',
    smtp_port: 465,
    smtp_user: 'resend',
    smtp_pass: requirements.RESEND_SMTP_PASSWORD,
    smtp_sender_name: 'Stephen at Kairos Housing',
    mailer_subjects_confirmation: 'Confirm your Worship Word Video account',
    mailer_templates_confirmation_content: templates.confirmation,
    mailer_subjects_invite: 'Your Worship Word Video invitation',
    mailer_templates_invite_content: templates.invite,
    mailer_subjects_recovery: 'Reset your Worship Word Video password',
    mailer_templates_recovery_content: templates.recovery,
  }),
});

if (!response.ok) {
  let message = 'Supabase rejected the email configuration.';
  try {
    const result = await response.json();
    if (typeof result?.message === 'string') message = result.message;
    else if (typeof result?.error === 'string') message = result.error;
  } catch {
    // Do not print a raw response that could contain configuration values.
  }
  throw new Error(`${message} (HTTP ${response.status})`);
}

console.log('Supabase transactional email is configured for Worship Word Video. No secret values were printed.');
