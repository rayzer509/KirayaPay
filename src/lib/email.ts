import nodemailer from 'nodemailer';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export function generatePassword(): string {
  // Avoids ambiguous characters (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function sendTenantCredentials({
  to,
  tenantName,
  password,
}: {
  to: string;
  tenantName: string;
  password: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kiraya-pay.vercel.app';
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `KirayaPay <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your KirayaPay Tenant Portal Access',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#1A2B4C;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="color:#E8881A;font-size:24px;font-weight:700">KirayaPay</span>
        </div>
        <h2 style="color:#1A2B4C">Hi ${tenantName},</h2>
        <p style="color:#444">Your landlord has added you to the KirayaPay tenant portal. Use the details below to log in.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px 0;color:#444"><strong>Login URL:</strong> <a href="${appUrl}/login" style="color:#E8881A">${appUrl}/login</a></p>
          <p style="margin:0 0 8px 0;color:#444"><strong>Email:</strong> ${to}</p>
          <p style="margin:0;color:#444"><strong>Temporary Password:</strong> <span style="font-family:monospace;font-size:16px;background:#fff;padding:2px 8px;border-radius:4px;border:1px solid #ddd">${password}</span></p>
        </div>
        <p style="color:#888;font-size:13px">Please change your password after your first login. You can view your bills, pay rent, and contact your landlord through the portal.</p>
      </div>
    `,
  });
}

export async function sendTenantPasswordReset({
  to,
  tenantName,
  password,
}: {
  to: string;
  tenantName: string;
  password: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kiraya-pay.vercel.app';
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `KirayaPay <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your KirayaPay Password Has Been Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#1A2B4C;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="color:#E8881A;font-size:24px;font-weight:700">KirayaPay</span>
        </div>
        <h2 style="color:#1A2B4C">Hi ${tenantName},</h2>
        <p style="color:#444">Your landlord has reset your portal access. Use the new credentials below.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px 0;color:#444"><strong>Login URL:</strong> <a href="${appUrl}/login" style="color:#E8881A">${appUrl}/login</a></p>
          <p style="margin:0 0 8px 0;color:#444"><strong>Email:</strong> ${to}</p>
          <p style="margin:0;color:#444"><strong>New Password:</strong> <span style="font-family:monospace;font-size:16px;background:#fff;padding:2px 8px;border-radius:4px;border:1px solid #ddd">${password}</span></p>
        </div>
        <p style="color:#888;font-size:13px">Please change your password after logging in.</p>
      </div>
    `,
  });
}
