import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apply = process.argv.includes('--apply');
const templatesOnly = process.argv.includes('--templates-only');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const templateFiles = {
  confirmation: path.join(root, 'supabase/templates/confirmation.html'),
  invite: path.join(root, 'supabase/templates/invite.html'),
  recovery: path.join(root, 'supabase/templates/recovery.html'),
  passwordChanged: path.join(root, 'supabase/templates/password-changed.html'),
  emailChanged: path.join(root, 'supabase/templates/email-changed.html'),
};

const templates = Object.fromEntries(await Promise.all(
  Object.entries(templateFiles).map(async ([name, filename]) => [name, await readFile(filename, 'utf8')]),
));

const managementRequirements = {
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
};

const smtpRequirements = {
  GOOGLE_SMTP_APP_PASSWORD: process.env.GOOGLE_SMTP_APP_PASSWORD,
};

if (!apply && !templatesOnly) {
  console.log('Worship Word Video email configuration plan (no changes made)');
  console.log('Sender: Worship Word Video <stephen@kairoshousing.org.uk>');
  console.log('SMTP: smtp.gmail.com:587 using STARTTLS');
  console.log(`Templates ready: ${Object.keys(templates).join(', ')}`);
  for (const [name, value] of Object.entries({ ...managementRequirements, ...smtpRequirements })) {
    console.log(`${name}: ${value ? 'available' : 'missing'}`);
  }
  console.log('Use npm run email:configure:templates to update hosted templates without changing SMTP.');
  console.log('Use npm run email:configure:apply only when intentionally replacing the complete SMTP configuration.');
  process.exit(0);
}

const requirements = templatesOnly
  ? managementRequirements
  : { ...managementRequirements, ...smtpRequirements };
const missing = Object.entries(requirements).filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  throw new Error(`Email configuration was not changed. Missing: ${missing.join(', ')}`);
}

const templateConfiguration = {
  mailer_subjects_confirmation: 'Confirm your Worship Word Video account',
  mailer_templates_confirmation_content: templates.confirmation,
  mailer_subjects_invite: 'Your Worship Word Video invitation',
  mailer_templates_invite_content: templates.invite,
  mailer_subjects_recovery: 'Reset your Worship Word Video password',
  mailer_templates_recovery_content: templates.recovery,
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: 'Your Worship Word Video password was changed',
  mailer_templates_password_changed_notification_content: templates.passwordChanged,
  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: 'Your Worship Word Video email address was changed',
  mailer_templates_email_changed_notification_content: templates.emailChanged,
};

const fullSmtpConfiguration = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,
  smtp_admin_email: 'stephen@kairoshousing.org.uk',
  smtp_host: 'smtp.gmail.com',
  smtp_port: 587,
  smtp_user: 'stephen@kairoshousing.org.uk',
  smtp_pass: smtpRequirements.GOOGLE_SMTP_APP_PASSWORD,
  smtp_sender_name: 'Worship Word Video',
};

const endpoint = `https://api.supabase.com/v1/projects/${encodeURIComponent(managementRequirements.SUPABASE_PROJECT_REF)}/config/auth`;
const response = await fetch(endpoint, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${managementRequirements.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(templatesOnly
    ? templateConfiguration
    : { ...fullSmtpConfiguration, ...templateConfiguration }),
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

console.log(templatesOnly
  ? 'Supabase email templates and security notifications are updated. SMTP settings were not changed.'
  : 'Supabase SMTP, account templates and security notifications are configured. No secret values were printed.');
