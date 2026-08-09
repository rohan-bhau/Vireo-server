import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export function isCloudinaryConfigured(): boolean {
  return Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
}

export function getCloudinaryUploadParams(): {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp }, config.cloudinary.apiSecret || "");
  return {
    cloudName: config.cloudinary.cloudName,
    apiKey: config.cloudinary.apiKey,
    timestamp,
    signature,
  };
}

export async function uploadAttachmentToCloudinary(
  buffer: Buffer,
  filename: string,
  { projectKey }: { projectKey?: string } = {}
): Promise<{ url: string; publicId: string }> {
  const folder = "vireo-attachments";
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const result = await new Promise<{ url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${projectKey || "vireo"}-${Date.now()}-${safeName}`,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error("Cloudinary upload failed"));
        else resolve(result as { url: string; public_id: string });
      }
    );
    stream.end(buffer);
  });
  return { url: result.url, publicId: result.public_id };
}

export async function uploadWorkspaceAvatar(
  buffer: Buffer,
  filename: string,
  workspaceId: string
): Promise<{ url: string; publicId: string }> {
  const folder = "vireo-workspace-avatars";
  const result = await new Promise<{ url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `workspace-${workspaceId}-${Date.now()}`,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error("Cloudinary upload failed"));
        else resolve(result as { url: string; public_id: string });
      }
    );
    stream.end(buffer);
  });
  return { url: result.url, publicId: result.public_id };
}