import fs from "fs";
import path from "path";
import { getTransporter, sender } from "../config/email";
import { config } from "../config";

async function sendViaRelay(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch(config.emailRelayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-email-secret": config.emailRelaySecret,
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Relay ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.emailFrom, name: "Vireo" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (response.status !== 202) {
    const body = await response.text();
    throw new Error(`SendGrid ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaMailjet(to: string, subject: string, html: string): Promise<void> {
  const credentials = `${config.mailjet.apiKey}:${config.mailjet.secretKey}`;
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: config.emailFrom, Name: "Vireo" },
          To: [{ Email: to }],
          Subject: subject,
          HTMLPart: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailjet ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.brevoApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.brevoSenderEmail, name: config.brevoSenderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (response.status !== 201) {
    const body = await response.text();
    throw new Error(`Brevo ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const usesFreeMailbox = /@(gmail|yahoo|outlook|hotmail|icloud|aol)\./i.test(config.emailFrom);
  const from = usesFreeMailbox
    ? "Vireo <onboarding@resend.dev>"
    : `${sender.name} <${config.emailFrom}>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function trySend(
  to: string,
  subject: string,
  html: string,
  label: string
): Promise<void> {
  if (config.emailRelayUrl && config.emailRelaySecret) {
    try {
      await sendViaRelay(to, subject, html);
      console.log(`[Email] Sent ${label} to ${to} via Vercel relay`);
      return;
    } catch (error) {
      console.error(
        `[Email] Relay failed for ${label} to ${to}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  if (config.sendgridApiKey) {
    try {
      await sendViaSendGrid(to, subject, html);
      console.log(`[Email] Sent ${label} to ${to} via SendGrid`);
      return;
    } catch (error) {
      console.error(
        `[Email] SendGrid failed for ${label} to ${to}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  if (config.mailjet.apiKey) {
    try {
      await sendViaMailjet(to, subject, html);
      console.log(`[Email] Sent ${label} to ${to} via Mailjet`);
      return;
    } catch (error) {
      console.error(
        `[Email] Mailjet failed for ${label} to ${to}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  if (config.brevoApiKey) {
    try {
      await sendViaBrevo(to, subject, html);
      console.log(`[Email] Sent ${label} to ${to} via Brevo`);
      return;
    } catch (error) {
      console.error(
        `[Email] Brevo failed for ${label} to ${to}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  if (config.resendApiKey) {
    try {
      await sendViaResend(to, subject, html);
      console.log(`[Email] Sent ${label} to ${to} via Resend`);
      return;
    } catch (error) {
      console.error(
        `[Email] Resend failed for ${label} to ${to}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  try {
    const transporter = await getTransporter();
    await transporter.sendMail({ from: sender, to, subject, html });
    console.log(`[Email] Sent ${label} to ${to} via SMTP`);
  } catch (error) {
    console.error(
      `[Email] SMTP failed for ${label} to ${to}:`,
      error instanceof Error ? error.message : error
    );
  }
}

function loadTemplate(name: string): string {
  const filePath = path.join(__dirname, "..", "emails", name);
  return fs.readFileSync(filePath, "utf-8");
}

function compile(template: string, data: Record<string, string | undefined>): string {
  let html = template;
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(
      new RegExp(`{{\\s*${key}\\s*}}`, "g"),
      value || ""
    );
  }
  const conditionalIfRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  html = html.replace(conditionalIfRegex, (_match, key, content) => {
    return data[key] ? content : "";
  });
  return html;
}

export async function sendInvitationEmail(
  to: string,
  workspaceName: string,
  inviterName: string,
  token: string,
  message?: string
) {
  const acceptUrl = `${config.clientUrl}/invite/accept?token=${token}`;
  const declineUrl = `${config.clientUrl}/invite/decline?token=${token}`;

  const template = loadTemplate("invitation-email.html");
  const html = compile(template, {
    workspaceName,
    inviterName,
    inviteeEmail: to,
    acceptUrl,
    declineUrl,
    message,
  });

  await trySend(to, `You're invited to ${workspaceName} on Vireo`, html, "invitation email");
}

export async function sendWelcomeEmail(to: string, name: string) {
  const dashboardUrl = `${config.clientUrl}/dashboard`;

  const template = loadTemplate("welcome-email.html");
  const html = compile(template, {
    name,
    dashboardUrl,
  });

  await trySend(to, "Welcome to Vireo!", html, "welcome email");
}

export async function sendPasswordResetEmail(to: string, name: string, resetToken: string) {
  const resetUrl = `${config.clientUrl}/reset-password?token=${resetToken}`;

  const template = loadTemplate("reset-password-email.html");
  const html = compile(template, {
    name,
    email: to,
    resetUrl,
  });

  await trySend(to, "Reset your Vireo password", html, "password reset email");
}

export async function sendOtpEmail(to: string, name: string, otp: string) {
  const template = loadTemplate("otp-email.html");
  const html = compile(template, {
    otp,
    email: to,
    name,
  });

  await trySend(to, "Your Vireo verification code", html, "OTP email");
}

export async function sendNotificationEmail(
  to: string,
  userName: string,
  data: {
    type: string;
    actorName: string;
    taskId?: string;
    taskTitle?: string;
    message: string;
    workspaceId: string;
  }
) {
  const viewUrl = data.taskId
    ? `${config.clientUrl}/task/${data.taskId}`
    : `${config.clientUrl}/w/${data.workspaceId}`;
  const manageUrl = `${config.clientUrl}/profile/notifications`;

  const template = loadTemplate("notification-email.html");
  const html = compile(template, {
    userName,
    actorName: data.actorName,
    taskId: data.taskId || "",
    taskTitle: data.taskTitle || "",
    message: data.message,
    viewUrl,
    manageUrl,
    typeLabel: data.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  });

  const subject = data.taskId ? `[${data.taskId}] ${data.message}` : data.message;
  await trySend(to, subject, html, "notification email");
}
