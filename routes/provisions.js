import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Provision from '../models/Provision.js';

const router = express.Router();

const verifyAdminKey = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.body?.adminKey;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ── Public: list published provisions ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, act, search } = req.query;
    const query = { isPublished: true };
    if (act && act !== 'All') query.act = act;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { summary: { $regex: search, $options: 'i' } },
      { section: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
    const total = await Provision.countDocuments(query);
    const provisions = await Provision.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('title slug act section summary amendments isPublished updatedAt tags');
    res.json({ data: provisions, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public: single provision by slug (increments views) ─────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const provision = await Provision.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!provision) return res.status(404).json({ error: 'Not found' });
    res.json(provision);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: list ALL provisions (including drafts) ────────────────────────────
router.get('/admin/all', verifyAdminKey, async (req, res) => {
  try {
    const provisions = await Provision.find()
      .sort({ updatedAt: -1 })
      .select('title slug act section summary isPublished amendments updatedAt');
    res.json(provisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: AI generate provision data via Gemini ─────────────────────────────
router.post('/generate', verifyAdminKey, async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic is required' });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert in Indian GST and tax law. Generate a comprehensive amendment history tracker for the following topic: "${topic}"

Return ONLY a valid JSON object — no markdown fences, no explanation, just raw JSON — with this exact structure:
{
  "title": "Full descriptive title of the provision",
  "act": "one of: CGST Act, IGST Act, UTGST Act, GST (Compensation to States) Act, GST Rules, Customs Act, Income Tax Act",
  "section": "e.g. Section 16, Rule 36, Notification 12/2017-CT",
  "summary": "One clear sentence describing what this provision covers",
  "originalText": "The original provision text as enacted (2017 for GST). Write in plain text, be detailed and accurate.",
  "currentPosition": "The current position of law after all amendments as of today. Write in plain text, be detailed and accurate.",
  "amendments": [
    {
      "date": "YYYY-MM-DD",
      "source": "Amendment Act name or Notification number",
      "description": "One line: what specifically changed",
      "content": "Detailed explanation of the amendment in plain text"
    }
  ]
}

Sort amendments chronologically (oldest first). Be accurate with dates and notification numbers. If unsure of exact dates, use approximate year (YYYY-01-01).`;

    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim();

    // Strip markdown fences if Gemini wraps in ```json ... ```
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Gemini generation failed: ' + err.message });
  }
});

// ── Admin: create provision ──────────────────────────────────────────────────
router.post('/', verifyAdminKey, async (req, res) => {
  try {
    const provision = new Provision(req.body);
    await provision.save();
    res.status(201).json(provision);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: update provision ──────────────────────────────────────────────────
router.put('/:id', verifyAdminKey, async (req, res) => {
  try {
    const provision = await Provision.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!provision) return res.status(404).json({ error: 'Not found' });
    res.json(provision);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete provision ──────────────────────────────────────────────────
router.delete('/:id', verifyAdminKey, async (req, res) => {
  try {
    await Provision.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
