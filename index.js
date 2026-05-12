import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'node:fs';

// Import routes
import categoryRoutes from './routes/categories.js';
import newsRoutes from './routes/news.js';
import adminRoutes from './routes/admin.routes.js';
import contactRoutes from './routes/contact.routes.js';
import blogRoutes from './routes/blog.js';
import googleSearchRoutes from './routes/googleSearch.js';
import provisionRoutes from './routes/provisions.js';

// Import services
import { fetchNewsFromSources, enrichNewsData } from './services/newsFetcher.js';
import { generatePdfHtml, uploadPdfToS3, generatePdfFileName } from './services/pdfGenerator.js';
import { runAutoFetchAndGenerateNews } from './services/autoFetchRunner.js';

// Import models
import News from './models/News.js';
import Category from './models/Category.js';

import chatRoutes from './routes/chatRoutes.js';

// 1. Load environment variables from the .env file
dotenv.config({ override: true });

const activeGeminiKey = process.env.GEMINI_API_KEY || '';
const maskedGeminiKey = activeGeminiKey
  ? `${activeGeminiKey.slice(0, 8)}...${activeGeminiKey.slice(-4)}`
  : '(missing)';
console.error('[ENV] GEMINI_API_KEY loaded:', maskedGeminiKey);

// 2. Initialize the Express application
const app = express();

// 3. Middleware setup
app.use(cors()); // Allows our React frontend to securely talk to this server
app.use(express.json()); // Allows the server to understand JSON data

// Log all incoming requests
app.use((req, res, next) => {
  console.error(`[REQUEST] ${req.method} ${req.path}`, req.body ? 'with body' : 'no body');
  next();
});

// File-based logging for debugging
const logFile = '/tmp/chat-debug.log';
app.use((req, res, next) => {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${req.method} ${req.path} - body keys: ${Object.keys(req.body || {}).join(',')}\n`);
  next();
});

// 4. Mount API routes
console.error('[APP] Mounting routes...');
app.use('/api/categories', categoryRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/google-search', googleSearchRoutes);
app.use('/api/provisions', provisionRoutes);
console.error('[APP] About to mount chat routes...');
app.use('/api/chat', chatRoutes);
console.error('[APP] Chat routes mounted successfully!');
// 5. Test Route (Just to see if it works)
app.get('/api/status', (req, res) => {
  console.error('[APP] Status endpoint called');
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
  // Run at 4:30 PM IST every day for testing (daytime verification)
  // Cron format: minute hour day month day-of-week
  cron.schedule('57 16 * * *', async () => {
    console.log('⏰ Starting auto-fetch news task at 4:30 PM IST (testing)...');
    await runAutoFetchAndGenerateNews();
  }, {
    timezone: 'Asia/Kolkata',
  });

  // Alternative: Run every 6 hours for testing
  // cron.schedule('0 */6 * * *', async () => {
  //   console.log('⏰ Starting auto-fetch news task...');
  //   await autoFetchAndGenerateNews();
  // });
}

// Note: actual auto-fetch implementation moved to services/autoFetchRunner.js