/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
const multerS3 = require('multer-s3');
const fetch = require('node-fetch');
const newrelic = require('../newrelic');
const s3 = require('../connections/s3');
const Image = require('../models/image');

const { S3_BUCKET, S3_OBJECT_ACL } = require('../env');

const getImgixData = async (image) => {
  try {
    const url = `${await image.getSrc()}?fm=json`;
    const data = await fetch(url);
    if (!data.ok) {
      const error = new Error(data.statusText);
      error.status = data.status;
      throw error;
    }
    const body = await data.json();
    return body;
  } catch (e) {
    const { error } = console;
    error('Unable to parse imgix data for upload', e.message);
    newrelic.noticeError(e);
    if (e.status) return { error: true, status: e.status };
    throw e;
  }
};

const uploadToS3 = (req, file, image) => new Promise((resolve, reject) => {
  const storage = multerS3({
    s3,
    bucket: S3_BUCKET,
    acl: S3_OBJECT_ACL,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: async (r, f, cb) => {
      const key = await image.getKey();
      cb(null, key);
    },
  });
  storage._handleFile(req, file, (err, result) => {
    if (err) {
      reject(err);
    } else {
      resolve(result);
    }
  });
});

class DatabaseStorage {
  async _handleFile(req, file, cb) {
    try {
      const { width, height } = req.body;
      const { originalname, mimetype } = file;

      const payload = {
        filename: originalname,
        mimeType: mimetype,
      };
      if (width) payload.width = width;
      if (height) payload.height = height;

      const image = await Image.create(payload);
      const result = await uploadToS3(req, file, image);
      const { size, location, bucket } = result;

      // Set additional details from the upload response.
      image.set({
        size,
        uploadedAt: new Date(),
        s3: { location, bucket },
        imgix: await getImgixData(image),
      });
      await image.save();

      cb(null, {
        record: image,
        result,
      });
    } catch (e) {
      cb(e);
    }
  }

  _removeFile(req, file, cb) {
    cb(new Error('Removal of files is not yet implemented.'));
  }
}

module.exports = DatabaseStorage;
