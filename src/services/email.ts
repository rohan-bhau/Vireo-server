import fs from "fs";
import path from "path";
import { getTransporter, sender } from "../config/email";
import { config } from "../config";

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

  const transporter = getTransporter();
  await transporter.sendMail({
    from: sender,
    to,
    subject: `You're invited to ${workspaceName} on Vireo`,
    html,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  const dashboardUrl = `${config.clientUrl}/dashboard`;

  const template = loadTemplate("welcome-email.html");
  const html = compile(template, {
    name,
    dashboardUrl,
  });

  const transporter = getTransporter();
  await transporter.sendMail({
    from: sender,
    to,
    subject: "Welcome to Vireo!",
    html,
  });
}
