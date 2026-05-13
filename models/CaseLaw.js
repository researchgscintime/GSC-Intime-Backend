import mongoose from 'mongoose';

const SectionSchema = new mongoose.Schema({
  heading:  { type: String },
  emoji:    { type: String, default: '📋' },
  content:  { type: String }, // HTML (rich editor output)
  order:    { type: Number, default: 0 },
}, { _id: true });

const KeyRefSchema = new mongoose.Schema({
  label: { type: String },
  type:  { type: String }, // section | rule | circular | notification | act
}, { _id: false });

const CaseLawSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true },
  slug:       { type: String, unique: true },
  type:       { type: String, default: 'judgment' }, // judgment | circular | amendment | notification | order | other
  court:      { type: String },
  citation:   { type: String },
  date:       { type: Date },
  summary:    { type: String },  // one-liner for card
  sections:   [SectionSchema],
  keyReferences: [KeyRefSchema],
  gscComment: { type: String },  // HTML — GSC Intime's own commentary
  freeSourceNote: { type: String }, // what AI found/didn't find from free sources
  tags:       [{ type: String }],
  isPublished: { type: Boolean, default: false },
  views:      { type: Number, default: 0 },
}, { timestamps: true });

CaseLawSchema.pre('save', async function () {
  if (!this.slug) {
    this.slug =
      this.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80) +
      '-' + Date.now();
  }
});

export default mongoose.model('CaseLaw', CaseLawSchema);
