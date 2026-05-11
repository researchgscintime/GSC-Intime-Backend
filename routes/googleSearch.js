import express from 'express';

const router = express.Router();

const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ message: 'Unauthorized - Invalid admin key' });
  }
  next();
};

const detectFileType = (item) => {
  const url = (item.link || '').toLowerCase();
  const mime = (item.mime || '').toLowerCase();
  const fileFormat = (item.fileFormat || '').toLowerCase();

  if (mime.includes('pdf') || fileFormat.includes('pdf') || url.endsWith('.pdf')) return 'pdf';
  if (url.endsWith('.doc') || url.endsWith('.docx') || mime.includes('word') || fileFormat.includes('word')) return 'document';
  if (url.includes('docs.google.com')) return 'document';
  if (url.endsWith('.ppt') || url.endsWith('.pptx')) return 'document';
  if (url.includes('blog') || url.includes('/post/') || url.includes('/article/')) return 'article';
  return 'article';
};

// POST /api/google-search — proxy to Google Custom Search JSON API
router.post('/', verifyAdminKey, async (req, res) => {
  const { query, num = 10 } = req.body;

  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return res.status(503).json({
      message: 'Google Custom Search is not configured. Add GOOGLE_API_KEY and GOOGLE_CSE_ID to your .env file.',
    });
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: query,
      num: Math.min(num, 10),
    });

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        message: errBody?.error?.message || 'Google API error',
      });
    }

    const data = await response.json();
    const items = (data.items || []).map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      displayUrl: item.displayLink,
      fileType: detectFileType(item),
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || '',
    }));

    res.json({ items, totalResults: data.searchInformation?.totalResults || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error calling Google Search API', error: error.message });
  }
});

export default router;
