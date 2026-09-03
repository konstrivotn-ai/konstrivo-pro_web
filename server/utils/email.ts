// Minimal email sender utility. Uses Resend API via fetch if configured.
// In `test` mode it records sent emails to an in-memory array for assertions.
import { config } from '../config';

type SentEmail = { to: string; subject: string; text: string; html?: string };

const sentEmails: SentEmail[] = [];

export function getSentEmails() { return sentEmails; }

function clearSentEmails() { sentEmails.length = 0; }

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const subject = 'Réinitialisation de votre mot de passe — KONSTRIVO';
  const text = `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe KONSTRIVO.\n\nOuvrez le lien suivant pour choisir un nouveau mot de passe:\n${resetUrl}\n\nCe lien est valable pendant 1 heure et ne peut être utilisé qu'une seule fois.\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.\n\nL'équipe KONSTRIVO`;
  const html = `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe KONSTRIVO.</p><p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p><p>Ce lien est valable pendant 1 heure et ne peut être utilisé qu'une seule fois.</p><p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p><p>L'équipe KONSTRIVO</p>`;

  // Test mode: record emails in-memory for assertions, do not perform external calls.
  if (process.env.NODE_ENV === 'test') {
    sentEmails.push({ to, subject, text, html });
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn('[KONSTRIVO] Email not sent: RESEND_API_KEY or EMAIL_FROM not configured.');
    return false;
  }

  try {
    // Resend API payload — POST https://api.resend.com/emails
    const payload = {
      from,
      to: [to],
      subject,
      text,
      html,
    };

    // Use global fetch if available
    const fetchFn: any = (globalThis as any).fetch;
    if (!fetchFn) throw new Error('fetch not available');

    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res || res.status >= 400) {
      console.warn('[KONSTRIVO] Password reset email delivery failed');
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[KONSTRIVO] Password reset email delivery failed');
    return false;
  }
}

export { clearSentEmails };
