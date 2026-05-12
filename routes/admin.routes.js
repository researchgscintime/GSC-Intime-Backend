import express from 'express';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "../config/s3.js";
import { runAutoFetchAndGenerateNews } from '../services/autoFetchRunner.js';
import { extract } from '@extractus/article-extractor';

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

// Fetch full article content from a URL (for RSS import)
router.post('/fetch-article', verifyAdminKey, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const article = await extract(url, {}, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GSCIntimeBot/1.0)',
      },
    });

    // Strip HTML tags to plain text
    const stripHtml = (html = '') =>
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const textContent = stripHtml(article?.content || '');

    res.json({
      content: textContent,
      author: article?.author || '',
      published: article?.published || null,
    });
  } catch (err) {
    // Return empty — caller will fall back to snippet
    res.json({ content: '', author: '', published: null });
  }
});

export default router;

// Admin on-demand trigger
router.post('/run-fetch', verifyAdminKey, async (req, res) => {
  try {
    const result = await runAutoFetchAndGenerateNews();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to run fetch', details: err.message });
  }
});