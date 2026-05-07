import express from 'express';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "../config/s3.js";

const router = express.Router();

const getR2PublicBaseUrl = () => {
  const configuredUrl = process.env.R2_PUBLIC_URL || `${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  return configuredUrl.startsWith('http://') || configuredUrl.startsWith('https://')
    ? configuredUrl.replace(/\/$/, '')
    : `https://${configuredUrl.replace(/\/$/, '')}`;
};

/**
 * Admin Key Verification Middleware
 */
const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized - Invalid admin key" });
  }
  next();
};

router.post('/generate-upload-url', verifyAdminKey, async (req, res) => {
  const { fileName, fileType } = req.body;
  
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: `updates/${Date.now()}-${fileName}`, // Prevents name collisions
    ContentType: fileType,
  });

  try {
    // This gives the frontend a 60-second window to upload directly to Cloudflare R2
    const url = await getSignedUrl(r2Client, command, { expiresIn: 60 });
    res.json({ url, key: command.input.Key });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post('/generate-upload-urls', verifyAdminKey, async (req, res) => {
  const { files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files array is required' });
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: `updates/${Date.now()}-${index}-${file.fileName}`,
          ContentType: file.fileType,
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn: 60 });

        return {
          fileName: file.fileName,
          url,
          key: command.input.Key,
          publicUrl: `${getR2PublicBaseUrl()}/${command.input.Key}`,
        };
      })
    );

    res.json({ uploads });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate upload URLs' });
  }
});

export default router;