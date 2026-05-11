import express from 'express';
import Blog from '../models/Blog.js';

const router = express.Router();

const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ message: 'Unauthorized - Invalid admin key' });
  }
  next();
};

// GET all blog posts (public)
router.get('/', async (req, res) => {
  try {
    const { fileType, search, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isPublished: true };

    if (fileType && fileType !== 'all') {
      filter.fileType = fileType;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Blog.countDocuments(filter);
    const blogs = await Blog.find(filter)
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: blogs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
  }
});

// GET single blog post by slug (public)
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    blog.views += 1;
    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blog post', error: error.message });
  }
});

// POST create blog post (admin)
router.post('/', verifyAdminKey, async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, fileUrl, fileType, externalLink, tags, author } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const blog = new Blog({
      title,
      excerpt,
      content,
      coverImage,
      fileUrl,
      fileType: fileType || 'article',
      externalLink,
      tags: Array.isArray(tags) ? tags : (tags || '').split(',').map(t => t.trim()).filter(Boolean),
      author: author || 'GSC Intime',
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Error creating blog post', error: error.message });
  }
});

// PUT update blog post (admin)
router.put('/:id', verifyAdminKey, async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, fileUrl, fileType, externalLink, tags, author, isPublished } = req.body;

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { title, excerpt, content, coverImage, fileUrl, fileType, externalLink, tags, author, isPublished },
      { new: true, runValidators: true }
    );

    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Error updating blog post', error: error.message });
  }
});

// DELETE blog post (admin)
router.delete('/:id', verifyAdminKey, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting blog post', error: error.message });
  }
});

export default router;
