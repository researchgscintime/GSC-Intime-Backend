/**
 * Database Initialization Script
 * Run this once to set up default categories
 * 
 * Usage: node scripts/initializeDb.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';

dotenv.config();

const DEFAULT_CATEGORIES = [
  {
    name: 'GST',
    slug: 'gst',
    description: 'GST updates, circulars, council meetings, and compliance guidelines',
    color: '#3B82F6',
    icon: '📋',
  },
  {
    name: 'Customs',
    slug: 'customs',
    description: 'Customs duties, tariff changes, and border trade regulations',
    color: '#10B981',
    icon: '📦',
  },
  {
    name: 'Budget',
    slug: 'budget',
    description: 'Union Budget proposals, tax changes, and financial announcements',
    color: '#F59E0B',
    icon: '💰',
  },
  {
    name: 'Litigation',
    slug: 'litigation',
    description: 'Court rulings, tribunal decisions, and legal precedents',
    color: '#EF4444',
    icon: '⚖️',
  },
  {
    name: 'Archives',
    slug: 'archives',
    description: 'Historical documents, past updates, and reference materials',
    color: '#8B5CF6',
    icon: '📚',
  },
];

async function initializeDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if categories already exist
    const existingCount = await Category.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️  Database already has ${existingCount} categories. Skipping initialization.`);
      console.log('💡 To reset, run: db.categories.deleteMany({})');
      process.exit(0);
    }

    // Insert default categories
    const insertedCategories = await Category.insertMany(DEFAULT_CATEGORIES);
    console.log(`✅ Successfully created ${insertedCategories.length} default categories:`);
    insertedCategories.forEach((cat) => {
      console.log(`   - ${cat.icon} ${cat.name}`);
    });

    console.log('\n✨ Database initialization complete!');
    console.log('📊 You can now:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Access admin dashboard at /admin');
    console.log('   3. Create news articles');
    console.log('   4. View updates at /updates');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run initialization
initializeDatabase();
