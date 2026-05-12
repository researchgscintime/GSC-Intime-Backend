import express from 'express';
import Parser from 'rss-parser';

const router = express.Router();
const rssParser = new Parser({ timeout: 8000 });

const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ message: 'Unauthorized - Invalid admin key' });
  }
  next();
};

// Verified working Indian GST / Tax / Finance news RSS feeds (tested May 2026)
const RSS_SOURCES = [
  { name: 'Tax Guru',            url: 'https://taxguru.in/feed/' },
  { name: 'Economic Times Tax',  url: 'https://economictimes.indiatimes.com/wealth/tax/rssfeeds/49780338.cms' },
  { name: 'Economic Times Top',  url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'Live Mint',           url: 'https://www.livemint.com/rss/money' },
  { name: 'Moneycontrol',        url: 'https://www.moneycontrol.com/rss/latestnews.xml' },
  { name: 'Hindu Business Line', url: 'https://www.thehindubusinessline.com/feeder/default.rss' },
  { name: 'NDTV Profit',         url: 'https://feeds.feedburner.com/ndtvprofit-latest' },
];

const DATE_RANGE_MS = {
  today: 24 * 60 * 60 * 1000,        // 24 hours
  week:  7  * 24 * 60 * 60 * 1000,   // 7 days
  month: 30 * 24 * 60 * 60 * 1000,   // 30 days
};

const detectFileType = (url = '', title = '') => {
  const u = url.toLowerCase();
  const t = title.toLowerCase();
  if (u.endsWith('.pdf') || t.includes('pdf')) return 'pdf';
  if (u.endsWith('.doc') || u.endsWith('.docx')) return 'document';
  if (t.includes('circular') || t.includes('notification') || t.includes('order')) return 'pdf';
  return 'article';
};

// Try fetching a single RSS feed, return [] on any error
const fetchFeed = async (source) => {
  try {
    const feed = await rssParser.parseURL(source.url);
    const items = (feed.items || []).map((item) => ({
      title: item.title || '',
      snippet: item.contentSnippet || item.summary || '',
      url: item.link || '',
      displayUrl: source.name,
      fileType: detectFileType(item.link, item.title),
      pubDate: item.pubDate || item.isoDate || null,
    }));
    console.log(`[RSS] ✅ ${source.name}: ${items.length} items`);
    return items;
  } catch (err) {
    console.log(`[RSS] ❌ ${source.name}: ${err.message}`);
    return [];
  }
};

// POST /api/google-search — fetch from RSS feeds, filter by keyword + date
router.post('/', verifyAdminKey, async (req, res) => {
  const { query = '', dateRange = 'all' } = req.body;

  const cutoffMs = DATE_RANGE_MS[dateRange];
  const cutoffDate = cutoffMs ? new Date(Date.now() - cutoffMs) : null;

  try {
    // Fetch all feeds in parallel
    const allResults = (await Promise.all(RSS_SOURCES.map(fetchFeed))).flat();

    // Only apply date filter server-side; keyword filtering happens on the client
    const filtered = allResults.filter((item) => {
      if (cutoffDate && item.pubDate) {
        const pub = new Date(item.pubDate);
        if (!isNaN(pub) && pub < cutoffDate) return false;
      }
      return true;
    });

    // Sort all results newest first
    filtered.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate) : new Date(0);
      const db = b.pubDate ? new Date(b.pubDate) : new Date(0);
      return db - da;
    });

    res.json({ items: filtered, totalResults: filtered.length, source: 'rss' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news feeds', error: error.message });
  }
});

export default router;
