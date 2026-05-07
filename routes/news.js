import express from 'express';
import News from '../models/News.js';
import Category from '../models/Category.js';

const router = express.Router();

const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ message: 'Unauthorized - Invalid admin key' });
  }
  next();
};

// Get all news with filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let filter = { isPublished: true };

    // Filter by category
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    // Filter by search query
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await News.countDocuments(filter);
    const news = await News.find(filter)
      .populate('category')
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: news,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news', error: error.message });
  }
});

// Get single news article
router.get('/:slug', async (req, res) => {
  try {
    const news = await News.findOne({ slug: req.params.slug }).populate('category');
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Increment views
    news.views += 1;
    await news.save();

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news', error: error.message });
  }
});

// Create news article
router.post('/', verifyAdminKey, async (req, res) => {
  try {
    const { title, description, content, category, source, sourceUrl, image, pdfUrl, tags, author } = req.body;

    if (!title || !category) {
      return res.status(400).json({ message: 'Title and category are required' });
    }

    // Verify category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const news = new News({
      title,
      description,
      content,
      category,
      source,
      sourceUrl,
      image,
      pdfUrl,
      tags,
      author,
    });

    await news.save();
    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error creating news', error: error.message });
  }
});

// Update news article
router.put('/:id', verifyAdminKey, async (req, res) => {
  try {
    const { title, description, content, category, image, tags, author, isPublished } = req.body;

    const news = await News.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        content,
        category,
        image,
        tags,
        author,
        isPublished,
      },
      { new: true, runValidators: true }
    );

    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error updating news', error: error.message });
  }
});

// Delete news article
router.delete('/:id', verifyAdminKey, async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }
    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting news', error: error.message });
  }
});

export default router;
