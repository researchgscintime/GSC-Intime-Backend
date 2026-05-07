import axios from 'axios';
import Update from '../models/update.model.js';
import cron from 'node-cron';

// This is a placeholder for where you'd plug in your AI logic
const refineWithAI = async (rawText) => {
  // In a real scenario, you'd send 'rawText' to an AI API
  // For now, we simulate the AI "fine-tuning" the text
  return {
    summary: rawText.substring(0, 150) + "...",
    category: rawText.toLowerCase().includes('gst') ? 'GST' : 'Corporate Tax'
  };
};

export const fetchLatestTaxNews = async () => {
  try {
    console.log("System: Checking for latest tax updates...");
    
    // You would use a real News API or RSS feed URL here
    // For now, we use a placeholder fetch
    const response = await axios.get('https://newsapi.org/v2/everything?q=India+Tax+GST&apiKey=YOUR_API_KEY');
    
    const articles = response.data.articles.slice(0, 5); // Take top 5

    for (let article of articles) {
      const exists = await Update.findOne({ title: article.title });
      
      if (!exists) {
        const aiProcessed = await refineWithAI(article.description || article.content);
        
        const newUpdate = new Update({
          title: article.title,
          summary: aiProcessed.summary,
          category: aiProcessed.category,
          date: new Date(article.publishedAt)
        });
        
        await newUpdate.save();
        console.log(`✅ Saved new update: ${article.title}`);
      }
    }
  } catch (error) {
    console.error("❌ News Fetch Error:", error.message);
  }
};

// Schedule the task to run every 6 hours
cron.schedule('0 */6 * * *', () => {
  fetchLatestTaxNews();
});