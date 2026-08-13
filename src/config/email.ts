import dns from "dns";
import net from "net";
import nodemailer from "nodemailer";
import { config } from "./index";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function resolveIPv4(
  host: string
): Promise<{ host: string; servername?: string }> {
  if (net.isIP(host)) {
    return { host };
  }
  try {
    const addresses = await dns.promises.resolve4(host);
    if (addresses.length === 0) {
      return { host };
    }
    return { host: addresses[0], servername: host };
  } catch {
    return { host };
  }
}

export function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (config.smtp.host && config.smtp.user) {
      const { host, servername } = await resolveIPv4(config.smtp.host);
      const smtpOptions = {
        host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        requireTLS: true,
        ...(servername ? { tls: { servername } } : {}),
      };
      return nodemailer.createTransport(smtpOptions);
    }
    console.warn(
      "[Email] SMTP is NOT configured on this server (no SMTP_HOST/SMTP_USER/SMTP_PASS) — using a localhost:1025 dummy transporter. Emails will not be deliverable. Set the SMTP_* env vars (and EMAIL_FROM) in Render."
    );
    return nodemailer.createTransport({
      host: "localhost",
      port: 1025,
      ignoreTLS: true,
    });
  })();

  return transporterPromise;
}

export const sender = {
  name: "Vireo",
  address: config.emailFrom,
};