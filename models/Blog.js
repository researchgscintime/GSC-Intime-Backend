import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileType: {
      type: String,
      enum: ['article', 'pdf', 'image', 'document', 'link'],
      default: 'article',
    },
    externalLink: { type: String, default: '' },
    tags: [{ type: String }],
    author: { type: String, default: 'GSC Intime' },
    isPublished: { type: Boolean, default: true },
    publishedDate: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BlogSchema.pre('save', function () {
  if (this.isModified('title')) {
    const base = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 55);
    this.slug = `${base}-${Date.now()}`;
  }
});

export default mongoose.model('Blog', BlogSchema);
