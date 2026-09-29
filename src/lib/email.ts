import { getResend, EMAIL_FROM } from "./resend";

interface SendInviteEmailParams {
  to: string;
  recipientName: string;
  inviteUrl: string;
}

interface SendInviteEmailResult {
  success: boolean;
  error?: string;
}

export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function buildInviteUrl(token: string): string {
  return `${getAppUrl()}/invite/${token}`;
}

function buildInviteEmailHtml({
  recipientName,
  inviteUrl,
}: {
  recipientName: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f5f6;font-family:'Lato',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f6;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background-color:#00314f;padding:20px 40px;">
            <span style="font-family:'Philosopher',Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">Visory</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:16px;color:#00314f;">Hi ${recipientName},</p>
            <h1 style="margin:24px 0 12px;font-size:22px;font-weight:700;color:#00314f;font-family:'Philosopher',Georgia,serif;">
              Join Visory Performance &amp; Growth OS
            </h1>
            <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#00314f;">
              This is where you'll complete your monthly feedback cycle. Click the button below to set up your account and get started.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#df0074;">
                  <a href="${inviteUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'Lato',Arial,Helvetica,sans-serif;">
                    Set Up My Account
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#6b7683;line-height:1.5;">
              Or copy and paste this link into your browser:<br/>
              <a href="${inviteUrl}" style="color:#644ef7;word-break:break-all;">${inviteUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f3f5f6;padding:20px 40px;border-top:1px solid #ccd6dc;">
            <p style="margin:0;font-size:12px;color:#6b7683;text-align:center;">
              This invitation was sent by Visory. If you weren't expecting this, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendInviteEmail(
  params: SendInviteEmailParams
): Promise<SendInviteEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const html = buildInviteEmailHtml({
      recipientName: params.recipientName,
      inviteUrl: params.inviteUrl,
    });

    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: "Join Visory Performance & Growth OS",
      html,
    });

    if (error) {
      console.error("Failed to send invite email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to send invite email:", err);
    return { success: false, error: (err as Error).message };
  }
}

interface GenericEmailParams {
  recipientName: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Turns plain text into paragraphs, linking any bare URLs. */
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => escapeHtml(p).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#644ef7;word-break:break-all;">$1</a>'))
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#00314f;">${p}</p>`)
    .join("");
}

export function buildEmailHtml({ recipientName, heading, body, ctaLabel, ctaUrl }: GenericEmailParams): string {
  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td style="border-radius:6px;background-color:#df0074;">
                  <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'Lato',Arial,Helvetica,sans-serif;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </td>
              </tr>
            </table>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f5f6;font-family:'Lato',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f6;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#00314f;padding:20px 40px;">
            <span style="font-family:'Philosopher',Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">Visory</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:16px;color:#00314f;">Hi ${escapeHtml(recipientName)},</p>
            <h1 style="margin:24px 0 12px;font-size:22px;font-weight:700;color:#00314f;font-family:'Philosopher',Georgia,serif;">${escapeHtml(heading)}</h1>
            ${paragraphs(body)}
            ${cta}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f3f5f6;padding:20px 40px;border-top:1px solid #ccd6dc;">
            <p style="margin:0;font-size:12px;color:#6b7683;text-align:center;">
              Visory Performance &amp; Growth OS. You receive these because you have an account.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

interface SendEmailParams {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
}

/** Sends through Resend. Returns success false (never throws) when unconfigured or failing. */
export async function sendEmail(params: SendEmailParams): Promise<SendInviteEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: params.to,
      cc: params.cc && params.cc.length > 0 ? params.cc : undefined,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { success: false, error: (err as Error).message };
  }
}
