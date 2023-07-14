const { Schema } = require('mongoose');
const { buildImgixUrl } = require('@base-cms/image');
const accountService = require('../services/account');
const env = require('../env');

const { IMGIX_URL } = env;

const focalPointSchema = new Schema({
  x: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  y: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
});

const schema = new Schema({
  filename: {
    type: String,
    trim: true,
    required: true,
    set(v) {
      // Ensure the filename is always decoded.
      return decodeURIComponent(v);
    },
    get(v) {
      // Ensure the filename is always decoded.
      return decodeURIComponent(v);
    },
  },
  s3: {
    bucket: String,
    location: String,
  },
  imgix: {
    type: Object,
  },
  uploadedAt: {
    type: Date,
  },
  mimeType: {
    type: String,
    enum: ['image/jpeg', 'image/png', 'image/webm', 'image/gif'],
  },
  size: {
    type: Number,
    min: 0,
  },
  width: {
    type: Number,
    min: 0,
  },
  height: {
    type: Number,
    min: 0,
  },
  focalPoint: focalPointSchema,
});

schema.methods.getKey = async function getKey() {
  // The S3 bucket key. Generated from the account key, image id, and filename.
  const { key } = await accountService.retrieve();
  return `${key}/${this.id}/${this.filename}`;
};

schema.methods.getSrc = async function getSrc(withFocalPoint, params) {
  // The image src, for use with `img` elements.
  // Generated from the imgix url, the encoded account key, the id, and the encoded filename.
  const { key } = await accountService.retrieve();
  const src = `${IMGIX_URL}/${encodeURIComponent(key)}/${this.id}/${encodeURIComponent(this.filename)}`;
  const opts = { ...params };

  if (withFocalPoint) {
    // Append the focal point, if present.
    const { focalPoint = {} } = this;
    const { x = 0.5, y = 0.5 } = focalPoint;
    opts.crop = 'focalpoint';
    opts.fit = 'crop';
    opts.fpX = x;
    opts.fpY = y;
  }
  return buildImgixUrl(src, opts, { auto: 'format' });
};

module.exports = schema;
