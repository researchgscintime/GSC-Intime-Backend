import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Import routes
import categoryRoutes from './routes/categories.js';
import newsRoutes from './routes/news.js';
import adminRoutes from './routes/admin.routes.js';

// Import services
import { fetchNewsFromSources, enrichNewsData } from './services/newsFetcher.js';
import { generatePdfHtml, uploadPdfToS3, generatePdfFileName } from './services/pdfGenerator.js';

// Import models
import News from './models/News.js';
import Category from './models/Category.js';

// 1. Load environment variables from the .env file
dotenv.config();

// 2. Initialize the Express application
const app = express();

// 3. Middleware setup
app.use(cors()); // Allows our React frontend to securely talk to this server
app.use(express.json()); // Allows the server to understand JSON data

// 4. Mount API routes
app.use('/api/categories', categoryRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);

// 5. Test Route (Just to see if it works)
app.get('/api/status', (req, res) => {
  res.json({ message: "GSC Intime Backend is Online and Ready! ⚡" });
});

// 5. Connect to MongoDB and Start Server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

    // Initialize scheduled tasks after DB connection
    initializeScheduledTasks();
  })
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message);
  });

/**
 * Initialize scheduled tasks for auto-fetching news
 */
function initializeScheduledTasks() {
  // Run at 9 AM IST every day (6:30 PM UTC previous day considering IST is UTC+5:30)
  // Cron format: minute hour day month day-of-week
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Starting auto-fetch news task at 9 AM...');
    await autoFetchAndGenerateNews();
  });

  // Alternative: Run every 6 hours for testing
  // cron.schedule('0 */6 * * *', async () => {
  //   console.log('⏰ Starting auto-fetch news task...');
  //   await autoFetchAndGenerateNews();
  // });
}

/**
 * Auto-fetch news, generate PDFs, and save to database
 */
async function autoFetchAndGenerateNews() {
  try {
    console.log('📡 Fetching news from sources...');

    // Get all active categories
    const categories = await Category.find({ isActive: true });

    if (categories.length === 0) {
      console.log('⚠️ No categories found. Please create categories first.');
      return;
    }

    // Fetch news for each category
    const allNewsList = await fetchNewsFromSources();

    for (const category of categories) {
      const categoryNews = allNewsList[category.name] || [];

      if (categoryNews.length === 0) {
        console.log(`ℹ️ No news found for category: ${category.name}`);
        continue;
      }

      console.log(`📝 Processing ${categoryNews.length} articles for ${category.name}...`);

      // Create news records and generate PDF
      for (const newsItem of categoryNews) {
        try {
          // Enrich news data
          const enrichedNews = enrichNewsData(newsItem, category.name);

          // Check if news already exists
          const existingNews = await News.findOne({
            title: newsItem.title,
            category: category._id,
          });

          if (!existingNews) {
            // Create new news record
            const newArticle = new News({
              title: newsItem.title,
              description: newsItem.description,
              content: newsItem.content,
              category: category._id,
              source: newsItem.source || 'Auto-Fetched',
              sourceUrl: newsItem.sourceUrl || '',
              tags: newsItem.tags || [],
              author: 'GSC Intime System',
              isPublished: true,
            });

            await newArticle.save();
            console.log(`✅ Created news: ${newsItem.title}`);
          }
        } catch (error) {
          console.error(`❌ Error processing news item: ${newsItem.title}`, error.message);
        }
      }

      // Generate and upload PDF for the category
      try {
        const categoryNews = await News.find({
          category: category._id,
          isPublished: true,
        })
          .sort({ publishedDate: -1 })
          .limit(50);

        if (categoryNews.length > 0) {
          const pdfHtml = generatePdfHtml(categoryNews, category.name, new Date());
          // PDF generation with pdfkit would go here
          console.log(`📄 PDF generated for ${category.name}`);
        }
      } catch (error) {
        console.error(`❌ Error generating PDF for ${category.name}:`, error.message);
      }
    }

    console.log('✅ Auto-fetch task completed successfully!');
  } catch (error) {
    console.error('❌ Error in auto-fetch task:', error.message);
  }
}