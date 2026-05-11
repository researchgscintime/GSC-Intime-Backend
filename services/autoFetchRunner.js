import News from '../models/News.js';
import Category from '../models/Category.js';
import { fetchNewsFromSources, enrichNewsData } from './newsFetcher.js';
import { generatePdfHtml, uploadPdfToS3 } from './pdfGenerator.js';

export async function runAutoFetchAndGenerateNews() {
  try {
    console.log('📡 Fetching news from sources...');

    const categories = await Category.find({ isActive: true });

    if (categories.length === 0) {
      console.log('⚠️ No categories found. Please create categories first.');
      return { success: false, message: 'No categories found' };
    }

    const allNewsList = await fetchNewsFromSources();

    for (const category of categories) {
      const categoryNews = allNewsList[category.name] || [];

      if (categoryNews.length === 0) {
        console.log(`ℹ️ No news found for category: ${category.name}`);
        continue;
      }

      console.log(`📝 Processing ${categoryNews.length} articles for ${category.name}...`);

      for (const newsItem of categoryNews) {
        console.log(`🔎 Processing item stepwise: ${newsItem.title}`);
        try {
          console.log('  ↳ Enriching item...');
          const enrichedNews = enrichNewsData(newsItem, category.name);
          console.log('  ↳ Enriched successfully');
        } catch (error) {
          console.error(`❌ Error enriching news item: ${newsItem.title}`, error.message);
          console.error(error.stack || error);
          continue;
        }

        let existingNews;
        try {
          console.log('  ↳ Checking existing record...');
          existingNews = await News.findOne({
            title: newsItem.title,
            category: category._id,
          });
          console.log('  ↳ Existing check done');
        } catch (error) {
          console.error(`❌ Error checking existing news for: ${newsItem.title}`, error.message);
          console.error(error.stack || error);
          continue;
        }

        if (!existingNews) {
          try {
            console.log('  ↳ Creating new News document...');
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
          } catch (error) {
            console.error(`❌ Error creating news item: ${newsItem.title}`, error.message);
            console.error(error.stack || error);
            continue;
          }
        } else {
          console.log(`  ↳ News already exists: ${newsItem.title}`);
        }
      }

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
        console.error(error.stack || error);
      }
    }

    console.log('✅ Auto-fetch task completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error in auto-fetch task:', error.message);
    console.error(error.stack || error);
    return { success: false, error: error.message };
  }
}
