import mongoose from 'mongoose';

const AmendmentSchema = new mongoose.Schema({
  date: { type: Date },
  source: { type: String }, // e.g. "CGST Amendment Act 2018", "Notification 49/2019-CT"
  description: { type: String }, // one-liner for timeline display
  content: { type: String },     // full HTML text of the amendment
}, { _id: true });

const ProvisionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug:  { type: String, unique: true },
  act:   { type: String, default: 'CGST Act' }, // CGST Act / IGST Act / GST Rules / Customs Act
  section: { type: String },   // "Section 16", "Rule 36", etc.
  summary: { type: String },   // short card description
  originalText:    { type: String }, // HTML — provision as originally enacted
  currentPosition: { type: String }, // HTML — current law after all amendments
  amendments: [AmendmentSchema],
  isPublished: { type: Boolean, default: false },
  tags: [{ type: String }],
  views: { type: Number, default: 0 },
}, { timestamps: true });

ProvisionSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug =
      this.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' + Date.now();
  }
  next();
});

export default mongoose.model('Provision', ProvisionSchema);
