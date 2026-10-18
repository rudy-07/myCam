const nodemailer = require('nodemailer');

const SMTP_USER = process.env.SMTP_SENDER_EMAIL || 'verifymycloud@gmail.com';
const SMTP_PASS = process.env.SMTP_SENDER_PASSWORD || 'kmdv klhh wgbi ohye';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://localhost:5173').replace(/\/$/, '');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Generates email meta-context from Express request
 */
function getEmailMetaContext(req) {
  const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim() : '127.0.0.1';
  const ua = req ? (req.headers['user-agent'] || 'Unknown Client') : 'Web Browser';
  
  // Basic platform parsing
  let platform = 'Desktop Device';
  if (/windows/i.test(ua)) platform = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) platform = 'macOS';
  else if (/linux/i.test(ua)) platform = 'Linux';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS';

  let browser = 'Browser';
  if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';

  const time = new Date().toUTCString();

  return {
    meta_ip: ip,
    meta_platform: platform,
    meta_browser: browser,
    meta_location: 'Secure Network',
    meta_time: time,
  };
}

/**
 * Base email layout matching myCloud's designer dark-mode theme
 */
function baseEmailTemplate({ title, contentHtml, metaContext = {} }) {
  const hasMeta = metaContext && metaContext.meta_ip;

  const securityPanelHtml = hasMeta ? `
    <!-- ═══ SECURITY / DEVICE METADATA PANEL ═══ -->
    <tr>
      <td style="padding: 24px 12px 0 12px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: separate; background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px; overflow: hidden;">
          <tr>
            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 11px; font-weight: 750; color: #4a5568; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 12px;">
              Request Telemetry &amp; Security
            </td>
          </tr>
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="50%" class="mobile-stack mobile-padding-bottom" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #7c8ba8; line-height: 1.6;">
                    <strong style="color: #eef2ff; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">Device &amp; OS</strong>
                    ${metaContext.meta_platform || 'Secure Client'}
                  </td>
                  <td width="50%" class="mobile-stack" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #7c8ba8; line-height: 1.6;">
                    <strong style="color: #eef2ff; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">Browser</strong>
                    ${metaContext.meta_browser || 'Web Client'}
                  </td>
                </tr>
                <tr>
                  <td height="12" colspan="2" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
                <tr>
                  <td width="50%" class="mobile-stack mobile-padding-bottom" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #7c8ba8; line-height: 1.6;">
                    <strong style="color: #eef2ff; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">IP Address</strong>
                    ${metaContext.meta_ip}
                  </td>
                  <td width="50%" class="mobile-stack" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #7c8ba8; line-height: 1.6;">
                    <strong style="color: #eef2ff; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">Network Location</strong>
                    ${metaContext.meta_location || 'Authorized Origin'}
                  </td>
                </tr>
                <tr>
                  <td height="12" colspan="2" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #7c8ba8; line-height: 1.6; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                    <strong style="color: #eef2ff; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">Timestamp</strong>
                    ${metaContext.meta_time || 'Just now'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title || 'myCam Surveillance Notification'}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 10px !important; }
      .email-body { padding: 24px 16px !important; }
      .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mobile-padding-bottom { padding-bottom: 16px !important; }
    }
    .cta-btn:hover { background-color: #2563eb !important; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45) !important; }
  </style>
</head>
<body style="background-color: #060810; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #060810; width: 100%;">
    <tr>
      <td align="center" style="padding: 28px 0 54px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="width: 600px; border-collapse: collapse;">
          
          <!-- ═══ HEADER BRANDING ═══ -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 800; color: #eef2ff; letter-spacing: -0.02em; vertical-align: middle;">
                    my<span style="color: #3b82f6;">Cam</span>
                  </td>
                </tr>
              </table>
              <div style="font-size: 11px; color: #4a5568; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;">by mySphere Surveillance Systems</div>
            </td>
          </tr>

          <!-- ═══ MAIN CARD ═══ -->
          <tr>
            <td style="padding: 0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: separate; background-color: #0a0d1a; border: 1px solid #1a2035; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); overflow: hidden;">
                <tr>
                  <td class="email-body" style="padding: 40px 32px;">
                    ${contentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${securityPanelHtml}

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td align="center" style="padding: 36px 12px 0 12px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="border-top: 1px solid #1a2035; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; color: #4a5568; text-align: center; line-height: 1.6;">
                    &copy; 2026 mySphere Platform. All rights reserved.<br>
                    Zero-surveillance video infrastructure &middot; Direct WebRTC encryption &middot; Self-hosted storage<br>
                    Inquiries &amp; Support: <a href="mailto:kanhaiffco2007@gmail.com" style="color: #3b82f6; text-decoration: none;">kanhaiffco2007@gmail.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Renders Welcome Email HTML
 */
function renderWelcomeHtml({ name, verifyUrl, metaContext }) {
  const content = `
    <!-- Welcome Header -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" style="background-color: rgba(59,130,246,0.12); border-radius: 50%; width: 56px; height: 56px; border: 1.5px solid rgba(59,130,246,0.25); border-collapse: separate; overflow: hidden;">
            <tr>
              <td align="center" valign="middle">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; padding-bottom: 28px;">
          <h1 style="color: #eef2ff; font-size: 26px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.03em;">Welcome to myCam</h1>
          <p style="color: #7c8ba8; font-size: 15px; line-height: 1.6; margin: 0; max-width: 440px;">Your private, low-latency WebRTC video surveillance platform. We are thrilled to have you on board!</p>
        </td>
      </tr>
    </table>

    <!-- Body Copy -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; color: #7c8ba8; line-height: 1.7; padding-bottom: 24px;">
          Hello <strong style="color: #eef2ff;">${name || 'Operator'}</strong>,<br><br>
          Thank you for creating your account on myCam. With myCam, your surveillance feeds are streamed directly peer-to-peer over encrypted WebRTC with zero cloud relay lag, and all your footage remains on the storage hardware you own.
        </td>
      </tr>

      <!-- CTA Button -->
      <tr>
        <td align="center" style="padding-bottom: 32px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                <a href="${verifyUrl || APP_BASE_URL}" target="_blank" class="cta-btn" style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; transition: background-color 0.2s;">
                  Launch Surveillance Console &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Onboarding Checklist -->
      <tr>
        <td style="padding-bottom: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
            <tr>
              <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; font-weight: 750; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 14px;">
                Getting Started Checklist
              </td>
            </tr>
            <tr>
              <td>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td valign="top" width="24" style="font-family: Arial, sans-serif; font-size: 14px; color: #10b981; font-weight: bold; line-height: 1.6;">✓</td>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #7c8ba8; line-height: 1.6; padding-bottom: 8px;">
                      <strong style="color: #eef2ff;">Account Active</strong>: Your operator profile has been initialized.
                    </td>
                  </tr>
                  <tr>
                    <td valign="top" width="24" style="font-family: Arial, sans-serif; font-size: 14px; color: #3b82f6; font-weight: bold; line-height: 1.6;">○</td>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #7c8ba8; line-height: 1.6; padding-bottom: 8px;">
                      <strong style="color: #eef2ff;">Pair Broadcaster</strong>: Connect an Android device, USB camera, or RTSP feed to Cam 01.
                    </td>
                  </tr>
                  <tr>
                    <td valign="top" width="24" style="font-family: Arial, sans-serif; font-size: 14px; color: #3b82f6; font-weight: bold; line-height: 1.6;">○</td>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #7c8ba8; line-height: 1.6;">
                      <strong style="color: #eef2ff;">Calibrate Zones</strong>: Define polygon motion detection boundaries to filter out false alerts.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseEmailTemplate({
    title: 'Welcome to myCam | mySphere',
    contentHtml: content,
    metaContext,
  });
}

/**
 * Renders Password Reset Email HTML
 */
function renderPasswordResetHtml({ name, resetUrl, metaContext }) {
  const content = `
    <!-- Header -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" style="background-color: rgba(99,102,241,0.12); border-radius: 50%; width: 56px; height: 56px; border: 1.5px solid rgba(99,102,241,0.25); border-collapse: separate; overflow: hidden;">
            <tr>
              <td align="center" valign="middle">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; padding-bottom: 24px;">
          <h1 style="color: #eef2ff; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.03em;">Password Reset Request</h1>
          <p style="color: #7c8ba8; font-size: 14px; line-height: 1.6; margin: 0;">A password reset request was submitted for your myCam account.</p>
        </td>
      </tr>
    </table>

    <!-- Body Copy -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; color: #7c8ba8; line-height: 1.6; padding-bottom: 28px; text-align: center;">
          Hello <strong style="color: #eef2ff;">${name || 'Operator'}</strong>,<br>
          Please click the button below to set a new password. This recovery link is valid for <strong style="color: #3b82f6;">1 hour</strong>.
        </td>
      </tr>

      <!-- CTA Button: Reset Password -->
      <tr>
        <td align="center" style="padding-bottom: 30px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                <a href="${resetUrl}" target="_blank" class="cta-btn" style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; transition: background-color 0.2s;">
                  Reset Password &rarr;
                </a>
              </td>
            </tr>
          </table>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 11px; color: #4a5568; margin-top: 10px;">
            If the button does not work, copy and paste this link:<br>
            <a href="${resetUrl}" target="_blank" style="color: #3b82f6; text-decoration: none; word-break: break-all;">${resetUrl}</a>
          </div>
        </td>
      </tr>

      <!-- Security Advisory Notice -->
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #4a5568; line-height: 1.6; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
          <strong style="color: #eef2ff; display: block; font-size: 13px; padding-bottom: 4px;">Did not request this?</strong>
          If you did not request this password reset, you can safely ignore this email. Your current password remains unchanged and your video footage is completely secure.
        </td>
      </tr>
    </table>
  `;

  return baseEmailTemplate({
    title: 'Password Reset Request | myCam',
    contentHtml: content,
    metaContext,
  });
}

/**
 * Send Welcome Email
 */
async function sendWelcomeEmail(receiverEmail, name, req) {
  const metaContext = getEmailMetaContext(req);
  const verifyUrl = `${APP_BASE_URL}`;

  const plainText = `Welcome to myCam, ${name}!\n\n` +
    `Your personal WebRTC video surveillance console is ready.\n` +
    `Access your dashboard here:\n${verifyUrl}\n\n` +
    `Security Details:\n` +
    `IP: ${metaContext.meta_ip}\n` +
    `Device: ${metaContext.meta_platform}\n` +
    `Browser: ${metaContext.meta_browser}\n` +
    `Time: ${metaContext.meta_time}\n\n` +
    `Best,\nThe myCam Team`;

  const html = renderWelcomeHtml({ name, verifyUrl, metaContext });

  try {
    const info = await getTransporter().sendMail({
      from: `"myCam Support" <${SMTP_USER}>`,
      replyTo: 'kanhaiffco2007@gmail.com',
      to: receiverEmail,
      subject: 'Welcome to myCam | mySphere',
      text: plainText,
      html,
    });
    console.log(`[Email Service] Welcome email successfully dispatched to ${receiverEmail}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email Service] Failed to send welcome email to ${receiverEmail}:`, err.message);
    return false;
  }
}

/**
 * Send Password Reset Email
 */
async function sendPasswordResetEmail(receiverEmail, name, resetToken, req) {
  const metaContext = getEmailMetaContext(req);
  const resetUrl = `${APP_BASE_URL}/?view=reset&token=${resetToken}`;

  const plainText = `Hi ${name || 'Operator'},\n\n` +
    `You requested a password reset for your myCam account. Click the link below to set a new password (valid for 1 hour):\n` +
    `${resetUrl}\n\n` +
    `If you did not request this, you can safely ignore this email.\n\n` +
    `Request Telemetry:\n` +
    `IP: ${metaContext.meta_ip}\n` +
    `Device: ${metaContext.meta_platform}\n` +
    `Browser: ${metaContext.meta_browser}\n` +
    `Time: ${metaContext.meta_time}\n\n` +
    `The myCam Team`;

  const html = renderPasswordResetHtml({ name, resetUrl, metaContext });

  try {
    const info = await getTransporter().sendMail({
      from: `"myCam Security" <${SMTP_USER}>`,
      replyTo: 'kanhaiffco2007@gmail.com',
      to: receiverEmail,
      subject: 'Password Reset Request | myCam',
      text: plainText,
      html,
    });
    console.log(`[Email Service] Password reset email successfully dispatched to ${receiverEmail}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email Service] Failed to send reset email to ${receiverEmail}:`, err.message);
    return false;
  }
}

/**
 * Send Contact Message to support inbox and autoresponder to user
 */
async function sendContactMessage({ name, email, subject, category, message, company }, req) {
  if (company && company.trim()) {
    console.log('[Contact Service] Bot submission silently ignored.');
    return { success: true, message: 'Thanks, your message has been sent.' };
  }

  const metaContext = getEmailMetaContext(req);
  const supportRecipient = 'kanhaiffco2007@gmail.com';
  const categoryLabel = (category || 'General').toUpperCase();
  const safeSubject = (subject || 'General Inquiry').replace(/[\r\n]+/g, ' ').trim();

  // 1. Send notification to admin / support recipient
  const adminSubject = `[myCam ${categoryLabel}] ${safeSubject}`;
  const adminContent = `
    <h2 style="color: #eef2ff; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">New Contact Inquiry</h2>
    <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 18px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; color: #7c8ba8; font-size: 13px;"><strong style="color: #eef2ff;">From:</strong> ${name} &lt;${email}&gt;</p>
      <p style="margin: 0 0 8px 0; color: #7c8ba8; font-size: 13px;"><strong style="color: #eef2ff;">Category:</strong> <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${categoryLabel}</span></p>
      <p style="margin: 0; color: #7c8ba8; font-size: 13px;"><strong style="color: #eef2ff;">Subject:</strong> ${safeSubject}</p>
    </div>
    <div style="background-color: rgba(255, 255, 255, 0.02); border-left: 3px solid #3b82f6; padding: 14px 18px; font-size: 14px; color: #eef2ff; line-height: 1.7; white-space: pre-wrap;">
${message}
    </div>
  `;

  const adminHtml = baseEmailTemplate({
    title: adminSubject,
    contentHtml: adminContent,
    metaContext,
  });

  try {
    await getTransporter().sendMail({
      from: `"myCam Contact Desk" <${SMTP_USER}>`,
      replyTo: `${name} <${email}>`,
      to: supportRecipient,
      subject: adminSubject,
      text: `From: ${name} <${email}>\nCategory: ${categoryLabel}\nSubject: ${safeSubject}\n\nMessage:\n${message}\n\nTelemetry:\nIP: ${metaContext.meta_ip}\nDevice: ${metaContext.meta_platform}\nBrowser: ${metaContext.meta_browser}\nTime: ${metaContext.meta_time}`,
      html: adminHtml,
    });
    console.log(`[Contact Service] Delivered inquiry from ${email} to ${supportRecipient}`);
  } catch (err) {
    console.error(`[Contact Service] Failed to deliver inquiry to support:`, err.message);
  }

  // 2. Send Autoresponder to User (matching myCloud!)
  try {
    const autoSubject = `Re: [myCam ${categoryLabel}] ${safeSubject}`;
    const autoContent = `
      <h2 style="color: #eef2ff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Thank you for contacting myCam</h2>
      <p style="color: #7c8ba8; font-size: 14px; line-height: 1.7; margin: 0 0 20px 0;">
        Hello <strong style="color: #eef2ff;">${name}</strong>,<br><br>
        This is an automated confirmation that your message regarding <strong style="color: #eef2ff;">"${safeSubject}"</strong> was successfully delivered to our support team. We review every request carefully and will respond to you as soon as possible.
      </p>
      <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #3b82f6; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px;">Request Summary</div>
        <p style="margin: 0; color: #7c8ba8; font-size: 13px;"><strong>Category:</strong> ${categoryLabel}</p>
        <p style="margin: 4px 0 0 0; color: #7c8ba8; font-size: 13px;"><strong>Subject:</strong> ${safeSubject}</p>
        <p style="margin: 4px 0 0 0; color: #7c8ba8; font-size: 13px;"><strong>Reference ID:</strong> CAM-${Date.now().toString(36).toUpperCase()}</p>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 14px; font-size: 12px; color: #4a5568;">
        If you did not submit a contact request to myCam, someone may have entered your email address by mistake. You can safely ignore this email.
      </div>
    `;

    const autoHtml = baseEmailTemplate({
      title: autoSubject,
      contentHtml: autoContent,
      metaContext,
    });

    await getTransporter().sendMail({
      from: `"myCam Support" <${SMTP_USER}>`,
      replyTo: supportRecipient,
      to: email,
      subject: autoSubject,
      text: `Hello ${name},\n\nThis is an automated confirmation that your message regarding "${safeSubject}" was received. We will respond as soon as possible.\n\nBest,\nThe myCam Team`,
      html: autoHtml,
    });
    console.log(`[Contact Service] Autoresponder delivered to ${email}`);
  } catch (err) {
    console.error(`[Contact Service] Autoresponder notice:`, err.message);
  }

  return { success: true, message: 'Thanks, your message has been sent. We will review it as soon as we can.' };
}

module.exports = {
  getEmailMetaContext,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendContactMessage,
  renderWelcomeHtml,
  renderPasswordResetHtml,
};
