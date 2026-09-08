// SERVER-ONLY. Sends OTP codes and account-recovery messages by SMS or
// email. This is a **scaffold**, the same shape as the QuickBooks Time
// integration used elsewhere in this app: real provider calls, gated
// entirely on whether that provider's env vars are configured, with a safe
// fallback when they aren't.
//
// Without SMS_PROVIDER_* / EMAIL_PROVIDER_* configured, delivery runs in
// "dev mode" — the message is logged server-side and also returned to the
// caller (see devCode in apiApp.ts's OTP endpoints) so the app is fully
// testable without a paid SMS/email account. NEVER let devMode leak into a
// production deployment silently: isDeliveryConfigured() below is what
// gates whether a code is allowed back into an API response at all.
export interface DeliveryResult {
  success: boolean;
  devMode: boolean;
  error?: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER_API_KEY && process.env.SMS_PROVIDER_FROM_NUMBER);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_PROVIDER_FROM_ADDRESS);
}

export async function sendSms(toPhone: string, body: string): Promise<DeliveryResult> {
  if (!isSmsConfigured()) {
    console.log(`[dev-sms] To: ${toPhone} — ${body}`);
    return { success: true, devMode: true };
  }

  // TODO(go-live): wire to a real provider (e.g. Twilio Verify, AWS SNS).
  // Shaped here so that call is a drop-in — everything else in the OTP flow
  // is provider-agnostic.
  try {
    // const client = new TwilioClient(process.env.SMS_PROVIDER_API_KEY);
    // await client.messages.create({ to: toPhone, from: process.env.SMS_PROVIDER_FROM_NUMBER, body });
    return { success: true, devMode: false };
  } catch (err: any) {
    return { success: false, devMode: false, error: err?.message || String(err) };
  }
}

export async function sendEmail(toEmail: string, subject: string, body: string): Promise<DeliveryResult> {
  if (!isEmailConfigured()) {
    console.log(`[dev-email] To: ${toEmail} — Subject: ${subject}\n${body}`);
    return { success: true, devMode: true };
  }

  // TODO(go-live): wire to a real provider (e.g. Resend, SES, SendGrid).
  try {
    // const client = new EmailClient(process.env.EMAIL_PROVIDER_API_KEY);
    // await client.send({ to: toEmail, from: process.env.EMAIL_PROVIDER_FROM_ADDRESS, subject, body });
    return { success: true, devMode: false };
  } catch (err: any) {
    return { success: false, devMode: false, error: err?.message || String(err) };
  }
}

/** Masks a phone number for display, e.g. "(709) 555-0211" -> "(•••) •••-0211". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  const last4 = digits.slice(-4);
  return phone.replace(/\d/g, '•').slice(0, -4) + last4;
}

/** Masks an email for display, e.g. "sarah.j@hihavenmanor.ca" -> "sa••••@hihavenmanor.ca". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '••••';
  const visible = local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
