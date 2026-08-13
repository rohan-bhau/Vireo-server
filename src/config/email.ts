import nodemailer from "nodemailer";
import { config } from "./index";

let transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (config.smtp.host && config.smtp.user) {
    const smtpOptions = {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      family: 4,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      requireTLS: true,
    };
    transporter = nodemailer.createTransport(smtpOptions);
  } else {
    transporter = nodemailer.createTransport({
      host: "localhost",
      port: 1025,
      ignoreTLS: true,
    });
  }

  return transporter;
}

export const sender = {
  name: "Vireo",
  address: config.emailFrom,
};
