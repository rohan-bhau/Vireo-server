import nodemailer from "nodemailer";
import { config } from "./index";

let transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      requireTLS: true,
    });
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
