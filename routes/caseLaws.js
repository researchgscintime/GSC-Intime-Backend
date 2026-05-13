import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extract } from '@extractus/article-extractor';
import CaseLaw from '../models/CaseLaw.js';

const router = express.Router();

const verifyAdminKey = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if (key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ── Paid / premium databases ──────────────────────────────────────────────────
const PAID_SOURCES = [
  { name: 'Tax Management India (TMI)',  url: 'https://www.taxtmi.com',                       hint: 'Most comprehensive GST database — search by citation or party name', category: 'paid' },
  { name: 'SCC Online',                  url: 'https://www.scconline.com',                    hint: 'Full text judgments — Supreme Court, High Courts, Tribunals',        category: 'paid' },
  { name: 'Manupatra',                   url: 'https://www.manupatrafast.com',                hint: 'Tax and corporate law — full text + headnotes',                       category: 'paid' },

  // Free databases
  { name: 'Indian Kanoon',               url: 'https://indiankanoon.org',                     hint: 'Free — full text from all Indian courts including all High Courts',   category: 'free' },
  { name: 'Tax Guru (Case Laws)',        url: 'https://taxguru.in/category/case-laws/',       hint: 'Free summaries — GST/Income Tax updates',                             category: 'free' },
  { name: 'CBIC (Official)',             url: 'https://cbic-gst.gov.in',                      hint: 'Official CBIC — circulars, notifications, orders',                    category: 'free' },
  { name: 'PIB (Finance Ministry)',      url: 'https://pib.gov.in/allRel.aspx?reg=3&lang=1',  hint: 'Finance Ministry press releases — GST Council, budget updates',       category: 'free' },
  { name: 'Ministry of Finance',         url: 'https://www.finmin.nic.in',                    hint: 'Official MoF — press notes, orders, notifications',                   category: 'free' },

  // Supreme Court
  { name: 'Supreme Court of India',      url: 'https://www.sci.gov.in/judgments',             hint: 'Official SC judgments portal',                                        category: 'hc' },
  { name: 'CESTAT (Tribunals)',          url: 'https://cestat.gov.in',                        hint: 'Customs, Excise & Service Tax Appellate Tribunal judgments',           category: 'hc' },

  // High Courts
  { name: 'Allahabad High Court',        url: 'https://www.allahabadhighcourt.in',            hint: 'UP & Uttarakhand — one of the busiest for tax cases',                  category: 'hc' },
  { name: 'Bombay High Court',           url: 'https://bombayhighcourt.nic.in',               hint: 'Maharashtra, Goa, Dadra & Nagar Haveli',                               category: 'hc' },
  { name: 'Delhi High Court',            url: 'https://dhcapexportal.nic.in',                 hint: 'National Capital Territory — very active in GST',                      category: 'hc' },
  { name: 'Madras High Court',           url: 'https://hcmadras.tn.nic.in',                   hint: 'Tamil Nadu & Puducherry',                                              category: 'hc' },
  { name: 'Karnataka High Court',        url: 'https://hckinfo.nic.in',                       hint: 'Karnataka — Bangalore bench active in GST matters',                    category: 'hc' },
  { name: 'Gujarat High Court',          url: 'https://hcguj.nic.in',                         hint: 'Gujarat — frequently cited in GST advance rulings',                    category: 'hc' },
  { name: 'Calcutta High Court',         url: 'https://www.calcuttahighcourt.gov.in',         hint: 'West Bengal, Andaman & Nicobar',                                       category: 'hc' },
  { name: 'Kerala High Court',           url: 'https://hckerala.gov.in',                      hint: 'Kerala & Lakshadweep',                                                 category: 'hc' },
  { name: 'Punjab & Haryana HC',         url: 'https://hcpb.gov.in',                          hint: 'Punjab, Haryana & Chandigarh',                                         category: 'hc' },
  { name: 'Rajasthan High Court',        url: 'https://hcraj.nic.in',                         hint: 'Rajasthan — Jodhpur & Jaipur benches',                                 category: 'hc' },
  { name: 'Andhra Pradesh HC',           url: 'https://hcap.nic.in',                          hint: 'Andhra Pradesh — Amaravati',                                           category: 'hc' },
  { name: 'Telangana High Court',        url: 'https://hcts.gov.in',                          hint: 'Telangana — Hyderabad bench',                                          category: 'hc' },
  { name: 'Madhya Pradesh HC',           url: 'https://mphc.gov.in',                          hint: 'Madhya Pradesh — Jabalpur, Indore, Gwalior benches',                   category: 'hc' },
  { name: 'Patna High Court',            url: 'https://patnahighcourt.gov.in',                hint: 'Bihar & Jharkhand',                                                    category: 'hc' },
  { name: 'Gauhati High Court',          url: 'https://ghcjudiciary.gov.in',                  hint: 'Northeast India — Assam, Nagaland, Mizoram, Arunachal Pradesh',        category: 'hc' },
  { name: 'Orissa High Court',           url: 'https://orissahighcourt.nic.in',               hint: 'Odisha',                                                               category: 'hc' },
  { name: 'Himachal Pradesh HC',         url: 'https://hphighcourt.nic.in',                   hint: 'Himachal Pradesh — Shimla',                                            category: 'hc' },
  { name: 'Jharkhand High Court',        url: 'https://jharkhandhighcourt.nic.in',            hint: 'Jharkhand — Ranchi',                                                   category: 'hc' },
  { name: 'Chhattisgarh High Court',     url: 'https://highcourt.cg.gov.in',                  hint: 'Chhattisgarh — Bilaspur',                                              category: 'hc' },
  { name: 'Uttarakhand High Court',      url: 'https://highcourt.uk.gov.in',                  hint: 'Uttarakhand — Nainital',                                               category: 'hc' },
  { name: 'J&K High Court',              url: 'https://jkhighcourt.nic.in',                   hint: 'Jammu & Kashmir and Ladakh',                                           category: 'hc' },
  { name: 'Tripura High Court',          url: 'https://thc.nic.in',                           hint: 'Tripura — Agartala',                                                   category: 'hc' },
  { name: 'Manipur High Court',          url: 'https://mhc.nic.in',                           hint: 'Manipur — Imphal',                                                     category: 'hc' },
  { name: 'Meghalaya High Court',        url: 'https://meghalayahighcourt.nic.in',            hint: 'Meghalaya — Shillong',                                                 category: 'hc' },
  { name: 'Sikkim High Court',           url: 'https://hcs.gov.in',                           hint: 'Sikkim — Gangtok',                                                     category: 'hc' },
];

// ── Free-site scrapers (fallback when Google grounding not available) ──────────

const fetchWithTimeout = (url, opts = {}, ms = 12000) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });

const extractText = (html) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Detect court name in query so IK can filter results to the right court
const detectCourt = (query) => {
  const q = query.toLowerCase();
  if (/gauhati|guwahati/.test(q)) return 'Gauhati High Court';
  if (/bombay|nagpur bench/.test(q)) return 'Bombay High Court';
  if (/\bdelhi\b/.test(q)) return 'Delhi High Court';
  if (/madras|chennai/.test(q)) return 'Madras High Court';
  if (/karnataka|bengaluru|bangalore/.test(q)) return 'Karnataka High Court';
  if (/gujarat|ahmedabad/.test(q)) return 'Gujarat High Court';
  if (/calcutta|kolkata/.test(q)) return 'Calcutta High Court';
  if (/kerala/.test(q)) return 'Kerala High Court';
  if (/punjab|haryana/.test(q)) return 'Punjab-Haryana High Court';
  if (/rajasthan/.test(q)) return 'Rajasthan High Court';
  if (/allahabad|lucknow/.test(q)) return 'Allahabad High Court';
  if (/andhra\s*pradesh/.test(q)) return 'Andhra Pradesh High Court';
  if (/telangana|hyderabad/.test(q)) return 'Telangana High Court';
  if (/madhya\s*pradesh/.test(q)) return 'Madhya Pradesh High Court';
  if (/patna|bihar/.test(q)) return 'Patna High Court';
  if (/orissa|odisha/.test(q)) return 'Orissa High Court';
  if (/himachal/.test(q)) return 'Himachal Pradesh High Court';
  if (/jharkhand/.test(q)) return 'Jharkhand High Court';
  if (/chhattisgarh/.test(q)) return 'Chhattisgarh High Court';
  if (/uttarakhand/.test(q)) return 'Uttarakhand High Court';
  if (/tripura/.test(q)) return 'Tripura High Court';
  if (/manipur/.test(q)) return 'Manipur High Court';
  if (/meghalaya/.test(q)) return 'Meghalaya High Court';
  if (/sikkim/.test(q)) return 'Sikkim High Court';
  if (/supreme\s*court/.test(q)) return 'Supreme Court of India';
  if (/cestat/.test(q)) return 'CESTAT';
  return null;
};

// Expand common legal abbreviations before sending to IK.
// IK does full-text search — if "uoi" never appears in the judgment text,
// IK gets zero term matches for it and falls back to irrelevant results.
const expandForIK = (query) => {
  const ABBR = [
    [/\buoi\b/gi,   'union of india'],
    [/\bgoi\b/gi,   'government of india'],
    [/\bcit\b/gi,   'commissioner income tax'],
    [/\bpccit\b/gi, 'principal commissioner income tax'],
    [/\bccgst\b/gi, 'commissioner central gst'],
    [/\bsgst\b/gi,  'state gst'],
    [/\bcgst\b/gi,  'central gst'],
    [/\bigst\b/gi,  'integrated gst'],
    [/\bsc\b/gi,    'supreme court'],
    [/\bhc\b/gi,    'high court'],
    [/\baat\b/gi,   'appellate authority'],
    [/\bgst\s*council\b/gi, 'gst council'],
    // IK spells it "Gauhati", not "Guwahati"
    [/\bguwahati\b/gi, 'gauhati'],
  ];
  let q = query;
  for (const [pat, rep] of ABBR) q = q.replace(pat, rep);
  return q;
};

// Build the cleanest possible IK search query from user's natural language input
const buildIKQuery = (rawQuery) => {
  const expanded = expandForIK(rawQuery);
  const detectedCourt = detectCourt(expanded);

  // Strip noise words that don't appear in judgment text
  let core = expanded
    .replace(/\b(case|the case of|in the matter of|writ petition|petition|vs\.?|versus)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Append the detected court name explicitly so it biases toward that court
  if (detectedCourt && !core.toLowerCase().includes(detectedCourt.toLowerCase())) {
    core = `${core} ${detectedCourt}`;
  }

  return { ikQuery: core, detectedCourt };
};

// Indian Kanoon — custom HTML parser (article-extractor misses IK's judgment divs)
const searchIndianKanoon = async (query) => {
  const results = [];
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  try {
    const { ikQuery, detectedCourt } = buildIKQuery(query);
    console.log('[IK] Expanded query:', ikQuery);

    // Run two searches in parallel:
    // 1. Relevance-sorted (default IK ranking)
    // 2. Newest-first — catches recent 2025/2026 judgments that have 0 citations
    //    and would otherwise rank low on relevance
    const makeUrl = (sortby) =>
      `https://indiankanoon.org/search/?formInput=${encodeURIComponent(ikQuery)}&doctypes=judgments&pagenum=0` +
      (sortby ? `&sortby=${sortby}` : '');

    const [relevanceHtml, newestHtml] = await Promise.all([
      fetchWithTimeout(makeUrl(''), { headers: { 'User-Agent': UA } }).then(r => r.text()).catch(() => ''),
      fetchWithTimeout(makeUrl('dateoforder'), { headers: { 'User-Agent': UA } }).then(r => r.text()).catch(() => ''),
    ]);
    // Extract doc links + titles from a search result HTML string
    const extractDocEntries = (html) => {
      const entries = [];
      const titleRegex = /<div class="result_title">\s*<a[^>]+href="(\/doc\/\d+\/)"[^>]*>([^<]+)<\/a>/g;
      let m;
      while ((m = titleRegex.exec(html)) !== null && entries.length < 6) {
        entries.push({ url: 'https://indiankanoon.org' + m[1], title: m[2].trim() });
      }
      return entries;
    };

    // Merge relevance + newest results, deduplicate by URL
    const seen = new Set();
    const allEntries = [];
    for (const entry of [...extractDocEntries(relevanceHtml), ...extractDocEntries(newestHtml)]) {
      if (!seen.has(entry.url)) { seen.add(entry.url); allEntries.push(entry); }
    }

    // If a specific court was detected, prefer results matching that court
    const courtLower = detectedCourt?.toLowerCase() || '';
    const sortedEntries = courtLower
      ? [
          ...allEntries.filter(e => e.title.toLowerCase().includes(courtLower.split(' ')[0])),
          ...allEntries.filter(e => !e.title.toLowerCase().includes(courtLower.split(' ')[0])),
        ]
      : allEntries;

    const docEntries = sortedEntries.slice(0, 4);

    // Fallback: pick any /doc/ links if title regex found nothing
    if (docEntries.length === 0) {
      const fallbackRegex = /href="(\/doc\/\d+\/)"/g;
      const combined = relevanceHtml + newestHtml;
      let m;
      while ((m = fallbackRegex.exec(combined)) !== null && docEntries.length < 3) {
        const url = 'https://indiankanoon.org' + m[1];
        if (!seen.has(url)) { seen.add(url); docEntries.push({ url, title: '' }); }
      }
    }

    // Extract snippets from the relevance-sorted page
    const snippets = [];
    const snippetRegex = /<div class="headnote"[^>]*>([\s\S]*?)<\/div>/g;
    let m;
    while ((m = snippetRegex.exec(relevanceHtml)) !== null && snippets.length < 4) {
      snippets.push(extractText(m[1]).slice(0, 600));
    }

    // 2. Fetch full text of each judgment page
    for (let i = 0; i < docEntries.length; i++) {
      const { url, title } = docEntries[i];
      let content = '';
      try {
        const docRes = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 15000);
        const docHtml = await docRes.text();

        // IK stores the judgment text in specific containers — try in order
        const selectors = [
          /<div[^>]+id="judgments"[^>]*>([\s\S]*?)(?=<div[^>]+id="|<script)/i,
          /<div[^>]+class="[^"]*judgments?[^"]*"[^>]*>([\s\S]*?)(?=<\/div>\s*<div[^>]+(?:id|class)=)/i,
          /<div[^>]+id="main-txt"[^>]*>([\s\S]*?)(?=<\/div>\s*<div[^>]+id=)/i,
          /<pre[^>]*>([\s\S]{500,}?)<\/pre>/i,
        ];

        for (const pattern of selectors) {
          const match = docHtml.match(pattern);
          if (match) {
            content = extractText(match[1]).replace(/\s{3,}/g, '  ').slice(0, 9000);
            if (content.length > 400) break;
          }
        }

        // Last resort: strip all tags from body
        if (content.length < 400) {
          const bodyMatch = docHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) content = extractText(bodyMatch[1]).slice(0, 7000);
        }

        // IK title is usually in <title> or h2
        let docTitle = title;
        if (!docTitle) {
          const tMatch = docHtml.match(/<title>([^|<]+)/i);
          if (tMatch) docTitle = tMatch[1].trim();
        }

        if (content.length > 300) {
          results.push({ url, title: docTitle || `Indian Kanoon Judgment ${i + 1}`, content });
        } else if (snippets[i]?.length > 100) {
          results.push({ url, title: docTitle || `Indian Kanoon Result ${i + 1}`, content: snippets[i] });
        }
      } catch (_) {
        // If full-page fetch fails, use snippet from search results
        if (snippets[i]?.length > 100) {
          results.push({ url, title: title || `Indian Kanoon Result ${i + 1}`, content: snippets[i] });
        }
      }
    }
  } catch (err) { console.log('[CaseLaw] Indian Kanoon search failed:', err.message); }
  return results;
};

// Tax Guru — direct HTML parsing
const searchTaxGuru = async (query) => {
  const results = [];
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  try {
    const searchUrl = `https://taxguru.in/?s=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(searchUrl, { headers: { 'User-Agent': UA } });
    const html = await res.text();

    const linkRegex = /href="(https:\/\/taxguru\.in\/(?:good-and-service-tax|income-tax|service-tax|corporate-law|company-law|custom-duty)\/[^"#?]+)"/g;
    const links = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null && links.length < 2) {
      if (!links.includes(m[1])) links.push(m[1]);
    }

    for (const link of links) {
      try {
        const artRes = await fetchWithTimeout(link, { headers: { 'User-Agent': UA } }, 12000);
        const artHtml = await artRes.text();

        // Tax Guru article content is in .entry-content or article tag
        let content = '';
        const selectors = [
          /<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*(?:related|comment|footer)[^"]*")/i,
          /<article[^>]*>([\s\S]*?)<\/article>/i,
        ];
        for (const pat of selectors) {
          const match = artHtml.match(pat);
          if (match) { content = extractText(match[1]).slice(0, 5000); if (content.length > 200) break; }
        }
        // Title
        const titleMatch = artHtml.match(/<title>([^|<–-]+)/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Tax Guru';

        if (content.length > 200) results.push({ url: link, title, content });
      } catch (_) { /* skip */ }
    }
  } catch (err) { console.log('[CaseLaw] Tax Guru search failed:', err.message); }
  return results;
};

// CBIC — circulars and notifications
const searchCBIC = async (query) => {
  const results = [];
  try {
    const kw = query.toLowerCase();
    if (!kw.includes('circular') && !kw.includes('notification') && !kw.includes('cbic') && !kw.includes('gst')) return results;

    for (const url of ['https://cbic-gst.gov.in/gst-circulars.html', 'https://cbic-gst.gov.in/gst-notifications.html']) {
      try {
        const article = await extract(url, {}, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)' } });
        if (article?.content) {
          const text = extractText(article.content).slice(0, 3000);
          if (text.length > 200) { results.push({ url, title: 'CBIC Official', content: text }); break; }
        }
      } catch (_) { /* skip */ }
    }
  } catch (_) { /* silent */ }
  return results;
};

// PIB — Finance Ministry press releases
const searchPIB = async (query) => {
  const results = [];
  try {
    // PIB search page for Finance Ministry
    const searchUrl = `https://pib.gov.in/allRel.aspx?reg=3&lang=1`;
    const article = await extract(searchUrl, {}, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)' },
    });
    if (article?.content) {
      const text = extractText(article.content).slice(0, 3000);
      if (text.length > 200) {
        results.push({ url: searchUrl, title: 'PIB — Finance Ministry Press Releases', content: text });
      }
    }
  } catch (err) { console.log('[CaseLaw] PIB search failed:', err.message); }
  return results;
};

// Run all free scrapers in parallel and combine results
const scrapeFreeSites = async (query) => {
  const kw = query.toLowerCase();
  const tasks = [
    searchIndianKanoon(query),
    searchTaxGuru(query),
    searchCBIC(query),
  ];
  // Add PIB for budget/GST Council/finance-related queries
  if (kw.includes('budget') || kw.includes('gst council') || kw.includes('finance') || kw.includes('pib') || kw.includes('press')) {
    tasks.push(searchPIB(query));
  }
  const arrays = await Promise.all(tasks);
  return arrays.flat();
};

// ── Public routes ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, type, search } = req.query;
    const query = { isPublished: true };
    if (type && type !== 'All') query.type = type.toLowerCase();
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { summary: { $regex: search, $options: 'i' } },
      { citation: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
    const total = await CaseLaw.countDocuments(query);
    const cases = await CaseLaw.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('title slug type court citation date summary sections keyReferences tags updatedAt');
    res.json({ data: cases, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:slug', async (req, res) => {
  try {
    const caseLaw = await CaseLaw.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!caseLaw) return res.status(404).json({ error: 'Not found' });
    res.json(caseLaw);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: list all ───────────────────────────────────────────────────────────
router.get('/admin/all', verifyAdminKey, async (req, res) => {
  try {
    const cases = await CaseLaw.find()
      .sort({ createdAt: -1 })
      .select('title slug type court citation date summary isPublished sections createdAt');
    res.json(cases);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: search sources ─────────────────────────────────────────────────────
router.post('/search-sources', verifyAdminKey, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  let freeSources = [];
  let aiSummary = '';
  let method = 'scraping'; // 'grounding' | 'scraping' | 'ai-only'

  // ── Attempt 1: Google Search grounding (paid Gemini plan) ──────────────────
  try {
    const groundedModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} }],
    });
    const result = await groundedModel.generateContent(
      `Search for this Indian legal case/circular/judgment: "${query}". ` +
      `Find sources from official court websites (Bombay HC, Delhi HC, Supreme Court), Indian Kanoon, CBIC, and legal databases. ` +
      `Summarize what you found in 3-5 sentences: what it is, which court/authority, and the outcome.`
    );
    const chunks = result.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    freeSources = chunks.filter(c => c.web?.uri)
      .map(c => ({ title: c.web.title || 'Source', url: c.web.uri, content: '' }))
      .slice(0, 8);
    aiSummary = result.response.text();
    method = 'grounding';
  } catch (_groundingErr) {

    // ── Attempt 2: Scrape free legal sites directly ────────────────────────
    try {
      const scraped = await scrapeFreeSites(query);
      freeSources = scraped.map(s => ({ title: s.title, url: s.url, content: s.content }));

      if (scraped.length > 0) {
        // Ask Gemini to summarise what was scraped
        const summaryModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const combined = scraped.map(s => `[${s.title}]\n${s.content.slice(0, 2000)}`).join('\n\n---\n\n');
        const summaryResult = await summaryModel.generateContent(
          `Based on the following material scraped from Indian legal websites, give a 3-4 sentence summary about "${query}" — what is it, which court/authority, and the outcome:\n\n${combined}`
        );
        aiSummary = summaryResult.response.text();
        method = 'scraping';
      } else {
        // ── Attempt 3: AI knowledge only ────────────────────────────────
        const basicModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await basicModel.generateContent(
          `Based on your training knowledge, summarise this Indian legal matter in 3-4 sentences: "${query}". ` +
          `Cover: what it is, which court/authority, approximate date, and outcome if known.`
        );
        aiSummary = result.response.text();
        method = 'ai-only';
      }
    } catch (scrapeErr) {
      console.log('[CaseLaw] Scraping failed:', scrapeErr.message);
      method = 'ai-only';
    }
  }

  const freeNotes = {
    grounding:  `Found ${freeSources.length} sources via live Google Search — Gemini will use these when generating the digest.`,
    scraping:   `Searched Indian Kanoon, Tax Guru and CBIC directly — found ${freeSources.length} result(s). Also check the databases below for paid full text.`,
    'ai-only':  'Could not reach live sites right now. Showing AI knowledge summary above. Check the databases below, upload a PDF, or paste text.',
  };

  res.json({
    freeSources,
    paidSources: PAID_SOURCES,
    freeFound: freeSources.length > 0,
    aiSummary,
    method,
    freeNote: freeNotes[method],
  });
});

// ── Admin: generate AI digest ─────────────────────────────────────────────────
router.post('/generate', verifyAdminKey, async (req, res) => {
  const { query = '', extraText = '', pdfBase64 = '' } = req.body;
  if (!query.trim() && !extraText.trim() && !pdfBase64) {
    return res.status(400).json({ error: 'Provide a query, paste text, or upload a PDF' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const researchInstruction =
      `Research this Indian legal matter thoroughly: "${query || 'the uploaded document'}"\n\n` +
      `CRITICAL — ORDER TYPE DISTINCTION:\n` +
      `A single case often has MULTIPLE orders — early interim stays AND a later final judgment. ` +
      `You MUST identify and use the FINAL DISPOSAL order (look for: "petition allowed", "petition dismissed", ` +
      `"partly allowed", "rule made absolute", "writ finally disposed", "judgment pronounced", ` +
      `"summons quashed", "show-cause notice quashed"). ` +
      `If you only find an INTERIM order (stay granted, matter admitted, adjourned, tagged with similar matters, ` +
      `next date of hearing), explicitly say so — do NOT present an interim order as the final judgment.\n\n` +
      `Extract: full title and citation, court/authority and bench, exact date, background facts, ` +
      `legal issues raised, arguments from both sides, court's reasoning and analysis, ` +
      `and the final operative order/relief granted.`;

    const researchParts = [{ text: researchInstruction }];
    if (pdfBase64) {
      researchParts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
      researchParts.push({ text: 'The uploaded PDF is the PRIMARY source — extract all details from it first.' });
    }
    if (extraText.trim().length > 50) {
      researchParts.push({ text: `\n\nADDITIONAL TEXT:\n${extraText}` });
    }

    let researchText = '';
    let sourceUrls = [];

    // ── Attempt 1: Google Search grounding ───────────────────────────────────
    try {
      const groundedModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ googleSearch: {} }],
      });
      const result = await groundedModel.generateContent({
        contents: [{ role: 'user', parts: researchParts }],
      });
      researchText = result.response.text();
      const chunks = result.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      sourceUrls = chunks.filter(c => c.web?.uri).map(c => c.web.uri);
    } catch (_groundingErr) {

      // ── Attempt 2: Scrape free sites then use as context ────────────────
      const scraped = query.trim() ? await scrapeFreeSites(query) : [];

      const fallbackParts = [...researchParts];
      if (scraped.length > 0) {
        const scrapedBlock = scraped
          .map((s, i) => `--- Source ${i + 1}: ${s.title} (${s.url}) ---\n${s.content.slice(0, 5000)}`)
          .join('\n\n');
        fallbackParts.push({ text: `\n\nMATERIAL SCRAPED FROM FREE LEGAL SITES:\n${scrapedBlock}` });
        sourceUrls = scraped.map(s => s.url);
      }

      const basicModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await basicModel.generateContent({
        contents: [{ role: 'user', parts: fallbackParts }],
      });
      researchText = result.response.text();
    }

    // ── Step 2: Format as structured JSON ─────────────────────────────────────
    const formatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const sourceNote = sourceUrls.length > 0
      ? `Sources: ${sourceUrls.slice(0, 3).join(' | ')}`
      : pdfBase64 ? 'Generated from uploaded PDF' : 'Generated from AI knowledge — verify independently';

    const formatPrompt = `You are a senior Indian tax law expert preparing a professional structured digest for a GST consultancy. Convert the research below into an accurate legal digest. Precision and correctness matter above all else — a practitioner will rely on this.

RESEARCH MATERIAL:
${researchText}

═══════════════════════════════════════════════
SECTION STRUCTURE RULES
═══════════════════════════════════════════════
1. Identify type: judgment | circular | amendment | notification | order | advance_ruling | other
2. Generate ONLY sections RELEVANT to this document — no fixed template:
   • Judgments: Background & Facts → Legal Issues → Arguments (Petitioner / Revenue) → Court's Analysis → Final Decision
   • Circulars/Notifications: Background → Key Clarification → Effective Date → Industry Impact
   • Amendments: What Changed → Before vs After Comparison → Effective Date → Compliance Impact
3. MANDATORY FINAL SECTION (always last, no exceptions):
   heading: "FINAL OUTCOME & PRACTICAL TAKEAWAYS", emoji: "✅"

   This section MUST be comprehensive, precise and nuanced. Minimum 6-8 bullet points total.
   A practitioner will act on this — every qualification matters. Structure EXACTLY as follows:

   PART A — OPERATIVE ORDER (2-4 sentences, no bullets):
   Use precise, professional judicial language. Model your phrasing on this standard:
   "The Court set aside the impugned order, accepted the petitioner's entitlement to [relief] under [provision], and granted the petitioner an opportunity to explain [issue] before the proper officer, who was directed to decide the acceptability of such explanation."

   Key phrasing rules:
   • "set aside the impugned order" — not "quashed the demand" or "allowed the ITC" or "ruled in favour"
   • "accepted the petitioner's entitlement to [X]" — not "allowed ITC" or "granted ITC"
   • "granted an opportunity to explain [specific issue] before the proper officer" — not "allowed rectification" or "permitted correction"
   • "directed [the officer] to decide the acceptability of such explanation" — not "directed to pass fresh order" or "remanded"
   • If a constitutional / validity challenge was NOT decided, say: "The Court declined to rule on the constitutional validity of [provision], leaving the question open"
   • If the relief was conditional or qualified (subject to further proceedings), say so explicitly — NEVER flatten a conditional outcome into a flat "allowed" or "granted" statement.

   PART B — GROUND-BY-GROUND ANALYSIS (one bullet per significant ground raised):
   For EACH legal ground raised — by either side — write a separate bullet in this format:
   • [Ground]: [what was argued] → Court's finding: [accepted / rejected / left open / remanded for fresh consideration]
   If a ground was left open or not decided, add: "— remains undecided; party must raise this in subsequent proceedings"
   If the court directed the petitioner to explain a specific factual issue (e.g., GSTR-1/GSTR-3B mismatch), state this as a separate bullet with the exact nature of the direction and who must decide it.

   PART C — WHAT WAS NOT DECIDED (mandatory whenever any issue was left open):
   • List every constitutional challenge, statutory validity challenge, or factual dispute that was NOT resolved by this order.
   • State any directions given to parties for further proceedings (e.g., "petitioner must file reply / attend hearing / produce documents within X days").
   • If the court explicitly declined to rule on a ground, say so.

   PART D — PRACTICAL IMPLICATIONS FOR TAXPAYERS (4-6 bullets):
   Conservative, qualified bullets. Each must state the specific condition under which it applies.
   Do NOT make sweeping statements. Use phrasing like "Taxpayers who [specific condition] may [implication] — however, [qualification]."
   Include a bullet if the outcome creates risk (e.g., "Section 16(4) bar remains active law — businesses relying solely on ITC claims without matching GSTR-1 entries face denial").
   Include a bullet on compliance action the taxpayer should take in light of the order.
4. Use • for ALL bullets. Plain text only — no HTML, no markdown, no asterisks.

═══════════════════════════════════════════════
LEGAL PRECISION RULES (critical — non-negotiable)
═══════════════════════════════════════════════
A. INTERIM vs FINAL — MOST IMPORTANT RULE:
   First determine which type of order the source material describes:

   FINAL JUDGMENT indicators (use these to confirm it is final):
   "petition allowed / dismissed / partly allowed", "rule made absolute", "writ finally disposed of",
   "summons quashed and set aside", "show-cause notice quashed", "judgment pronounced", "disposed of accordingly"

   INTERIM ORDER indicators (flag these — do NOT treat as final):
   "stay granted", "interim stay", "ad-interim relief", "matter admitted", "tagged with similar petitions",
   "directed not to take coercive action", "next date of hearing", "Revenue directed not to recover"

   • If the material is a FINAL judgment → summarise accordingly with precise outcome
   • If the material is an INTERIM order → add prominently as the FIRST bullet in FINAL OUTCOME:
     "⚠️ INTERIM ORDER ONLY: This digest covers an interim / ad-interim order, NOT the final judgment. The substantive questions remain pending final adjudication. Do not treat this as the final legal position."
   • If uncertain → state "Nature of order could not be confirmed from available material — verify independently."

   Other judicial language rules:
   • "the prayer to declare [rule/provision] ultra vires was rejected" — NOT "validity was upheld"
   • "writ petition partly allowed" / "petition dismissed" / "petition allowed" — use whichever fits
   • "quashed and set aside" for specific orders, notices or demands that were annulled

B. QUALIFYING CONDITIONS FOR TAX RULES:
   • Never state that a tax rule or provision applies broadly without listing its exact statutory conditions
   • Example: Do not say "any consideration triggers Rule 28(2)". Instead say "Rule 28(2) applies only where ALL of the following conditions are met: (1) there is a supply of service by way of corporate guarantee; (2) the supplier and recipient are related persons located in India; (3) the guarantee is provided to a banking company or financial institution on behalf of the related recipient; (4) the guarantee is issued or renewed on or after the effective date; (5) the proviso for full ITC availability must also be considered."
   • Similarly for any other rule — list the conditions from the statute, not a generalisation.

C. CROSS-REGIME CITATIONS:
   • If a cited case is from service tax, customs duty, income tax, or any regime other than GST, state this explicitly
   • Correct phrasing: "The Court applied the principle recognised in [Case Name] (a service tax / income tax matter) and held that the same reasoning applies in the GST context"
   • Do NOT present a service tax or pre-GST precedent as a direct GST authority without this qualification

D. SCOPE OF RULING:
   • If the ruling is based on specific facts that distinguish it from the general position, add a note: "⚠️ Fact-specific: This ruling turned on [key fact]. Businesses with different arrangements should seek independent advice before relying on it."

E. PRACTICAL IMPLICATIONS:
   • Be conservative — qualify each implication with the specific condition that makes it relevant
   • Do not make sweeping statements applicable to all taxpayers unless the ruling itself says so

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "Full descriptive title",
  "type": "judgment|circular|amendment|notification|order|advance_ruling|other",
  "court": "Court or authority name (empty string if not applicable)",
  "citation": "Citation if identifiable",
  "date": "YYYY-MM-DD or null",
  "summary": "One precise sentence for card display",
  "freeSourceNote": "${sourceNote}",
  "sections": [
    { "heading": "HEADING IN CAPS", "emoji": "🔍", "content": "...", "order": 1 }
  ],
  "keyReferences": [{ "label": "Section 7 CGST Act", "type": "section" }],
  "tags": ["gst", "tag2"]
}`;

    const formatResult = await formatModel.generateContent(formatPrompt);
    let raw = formatResult.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
});

// ── Admin: CRUD ───────────────────────────────────────────────────────────────

router.post('/', verifyAdminKey, async (req, res) => {
  try {
    const caseLaw = new CaseLaw(req.body);
    await caseLaw.save();
    res.status(201).json(caseLaw);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', verifyAdminKey, async (req, res) => {
  try {
    const caseLaw = await CaseLaw.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!caseLaw) return res.status(404).json({ error: 'Not found' });
    res.json(caseLaw);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', verifyAdminKey, async (req, res) => {
  try {
    await CaseLaw.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
