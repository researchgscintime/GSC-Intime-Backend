import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    source: {
      type: String,
      default: 'Manual Upload', // Can be 'Scraper', 'API', 'Manual Upload'
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '', // S3 URL or external image URL
    },
    pdfUrl: {
      type: String,
      default: '', // S3 URL for generated PDF
    },
    tags: [
      {
        type: String,
      },
    ],
    author: {
      type: String,
      default: 'GSC Intime',
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedDate: {
      type: Date,
      default: Date.now,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-generate slug from title
// Use synchronous pre hook (no callback) to avoid middleware "next is not a function" issues
NewsSchema.pre('save', function () {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
  }
});

export default mongoose.model('News', NewsSchema);
