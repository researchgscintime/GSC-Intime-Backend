import axios from 'axios';
import Parser from 'rss-parser';

/**
 * News Fetching Service
 * Fetches news from multiple sources and returns structured data
 */

// Mock news data - You can replace with real API integration
const mockNewsData = {
  GST: [
    {
      title: 'GSC Update-Securitisation - Key Considerations Under GST',
      description: 'Article on Securitisation covering key GST implications and compliance requirements',
      content: 'This update covers the Securitisation process and its GST implications...',
      source: 'GSC Intime',
      tags: ['GST', 'Securitisation', 'Compliance'],
    },
    {
      title: 'Advisory on Archival of Data - GST Compliance',
      description: 'Important advisory regarding data archival requirements under GST regulations',
      content: 'Data archival is critical for GST compliance. Here are the key requirements...',
      source: 'GSC Intime',
      tags: ['GST', 'Data Management', 'Archive'],
    },
    {
      title: 'GSC Update - Invoice Management System (IMS)',
      description: 'Draft Manual on Invoice Management System implementation',
      content: 'The Invoice Management System is a critical tool for modern GST compliance...',
      source: 'GSC Intime',
      tags: ['GST', 'IMS', 'Invoice'],
    },
  ],
  Customs: [
    {
      title: 'Union Budget 2026-27 - Customs Overview',
      description: 'Key proposals and changes in Customs duties for FY 2026-27',
      content: 'The 2026-27 budget proposes significant changes in Customs tariffs...',
      source: 'Government of India',
      tags: ['Customs', 'Budget', 'Tariff'],
    },
    {
      title: 'Customs Regulations - Recent Updates',
      description: 'Latest customs notifications and regulatory changes',
      content: 'Several new customs notifications have been issued recently...',
      source: 'CBIC',
      tags: ['Customs', 'Regulations', 'Updates'],
    },
  ],
  Budget: [
    {
      title: 'Union Budget 2026-27 - Complete Overview',
      description: 'Complete analysis of Union Budget 2026-27 covering all tax aspects',
      content: 'The 2026-27 union budget brings major changes across direct and indirect taxes...',
      source: 'Ministry of Finance',
      tags: ['Budget', 'Overview', 'Tax'],
    },
    {
      title: 'Union Budget 2025-26 - GST Implications',
      description: 'GST related changes and proposals in Union Budget 2025-26',
      content: 'Key GST proposals in the 2025-26 budget include...',
      source: 'Ministry of Finance',
      tags: ['Budget', 'GST', '2025-26'],
    },
  ],
  Litigation: [
    {
      title: 'Recent Tribunal Decisions - GST Litigation Updates',
      description: 'Summary of recent GST tribunal decisions affecting businesses',
      content: 'Recent tribunal decisions highlight important precedents for GST matters...',
      source: 'GSC Intime',
      tags: ['Litigation', 'Tribunal', 'Decisions'],
    },
  ],
};

/**
 * Fetch news from external sources
 * Can be extended with real API integrations
 */
/**
 * Fetch news from configured RSS feeds (set NEWS_RSS_FEEDS env var as JSON)
 * Example: export NEWS_RSS_FEEDS='{"GST":["https://example.com/gst.rss"],"Customs":["https://example.com/customs.rss"]}'
 * If no RSS config is provided, falls back to mock data.
 */
export const fetchNewsFromSources = async () => {
  try {
    const rssConfig = process.env.NEWS_RSS_FEEDS;
    if (!rssConfig) {
      // No external feeds configured; return mock data
      return mockNewsData;
    }

    let feedsMap;
    try {
      feedsMap = JSON.parse(rssConfig);
    } catch (err) {
      console.error('Invalid NEWS_RSS_FEEDS JSON:', err.message);
      return mockNewsData;
    }

    const parser = new Parser();
    const result = {};

    // For each category, fetch all configured feeds and merge items
    for (const [category, urls] of Object.entries(feedsMap)) {
      result[category] = [];
      if (!Array.isArray(urls)) continue;

      for (const url of urls) {
        try {
          const feed = await parser.parseURL(url);
          if (feed && Array.isArray(feed.items)) {
            for (const item of feed.items) {
              result[category].push({
                title: item.title || item.pubDate || 'Untitled',
                description: item.contentSnippet || item.summary || '',
                content: item.content || item['content:encoded'] || '',
                source: feed.title || (new URL(url)).hostname,
                sourceUrl: item.link || url,
                tags: [],
              });
            }
          }
        } catch (err) {
          console.error(`Failed to fetch/parse RSS feed ${url}:`, err.message);
        }
      }
    }

    // If nothing was fetched, fall back to mock
    const anyFetched = Object.values(result).some(arr => Array.isArray(arr) && arr.length > 0);
    return anyFetched ? result : mockNewsData;
  } catch (error) {
    console.error('Error fetching news from sources:', error);
    return mockNewsData;
  }
};

/**
 * Fetch specific category news
 */
export const fetchNewsByCategory = async (category) => {
  try {
    if (mockNewsData[category]) {
      return mockNewsData[category];
    }
    return [];
  } catch (error) {
    console.error(`Error fetching ${category} news:`, error);
    return [];
  }
};

/**
 * Parse and enrich news data
 * Add AI processing, categorization, etc.
 */
export const enrichNewsData = (newsItem, category) => {
  return {
    ...newsItem,
    category,
    processedDate: new Date(),
    confidence: 0.95, // AI confidence score
  };
};

export default {
  fetchNewsFromSources,
  fetchNewsByCategory,
  enrichNewsData,
};
