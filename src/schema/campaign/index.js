const { Schema } = require('mongoose');
const connection = require('../../connections/mongoose/instance');
const validator = require('validator');
const CreativeSchema = require('./creative');
const CriteriaSchema = require('./criteria');
const { applyElasticPlugin, setEntityFields } = require('../../elastic/mongoose');
const {
  deleteablePlugin,
  notifyPlugin,
  paginablePlugin,
  pushIdPlugin,
  referencePlugin,
  repositoryPlugin,
  searchablePlugin,
} = require('../../plugins');

const externalLinkSchema = new Schema({
  label: {
    type: String,
    required: false,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator(v) {
        if (!v) return false;
        return validator.isURL(v, {
          protocols: ['http', 'https'],
          require_protocol: true,
        });
      },
      message: 'Invalid external link URL for {VALUE}',
    },
  },
});

const schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: false,
    trim: false,
  },
  advertiserName: {
    type: String,
  },
  ready: {
    type: Boolean,
    required: true,
    default: false,
  },
  paused: {
    type: Boolean,
    required: true,
    default: false,
  },
  url: {
    type: String,
    trim: true,
    validate: {
      validator(v) {
        if (!v) return true;
        return validator.isURL(v, {
          protocols: ['http', 'https'],
          require_protocol: true,
        });
      },
      message: 'Invalid campaign URL for {VALUE}',
    },
  },
  creatives: [CreativeSchema],
  criteria: CriteriaSchema,
  externalLinks: [externalLinkSchema],
}, { timestamps: true });

setEntityFields(schema, 'name');
setEntityFields(schema, 'advertiserName');
applyElasticPlugin(schema, 'campaigns');

schema.plugin(referencePlugin, {
  name: 'advertiserId',
  connection,
  modelName: 'advertiser',
  options: { required: true, es_indexed: true, es_type: 'keyword' },
});
schema.plugin(referencePlugin, {
  name: 'storyId',
  connection,
  modelName: 'story',
  options: { required: false },
});

schema.plugin(deleteablePlugin, {
  es_indexed: true,
  es_type: 'boolean',
});
schema.plugin(notifyPlugin);
schema.plugin(pushIdPlugin, { required: true });
schema.plugin(repositoryPlugin);
schema.plugin(paginablePlugin);
schema.plugin(searchablePlugin, { fieldNames: ['name', 'advertiserName'] });

schema.virtual('status').get(function getStatus() {
  const start = this.get('criteria.start');
  const end = this.get('criteria.end');

  if (this.deleted) return 'Deleted';
  if (!this.ready) return 'Incomplete';
  if (end && end.valueOf() > Date.now()) return 'Finished';
  if (start.valueOf() <= Date.now()) {
    return this.paused ? 'Paused' : 'Running';
  }
  return 'Scheduled';
});

schema.method('getRequirements', async function getRequirements() {
  const {
    storyId,
    url,
    criteria,
    creatives,
  } = this;

  const needs = [];
  const start = criteria.get('start');
  if (!start) needs.push('a start date');
  if (!criteria.get('placementIds.length')) needs.push('a placement');
  if (!creatives.filter(cre => cre.active).length) needs.push('an active creative');
  if (storyId) {
    const story = await connection.model('story').findById(storyId);
    const storyNeed = 'an active story';

    if (story.status === 'Scheduled') {
      if (start && story.publishedAt.valueOf() > start.valueOf()) {
        needs.push(storyNeed);
      }
    } else if (story.status !== 'Published') {
      needs.push(storyNeed);
    }
  } else if (!url) {
    needs.push('a URL');
  }
  return needs.sort().join(', ');
});

schema.pre('save', async function setAdvertiserForStory() {
  if (this.isModified('storyId')) {
    const story = await connection.model('story').strictFindById(this.storyId, { advertiserId: 1 });
    this.advertiserId = story.advertiserId;
  }
});

schema.pre('save', async function setAdvertiserName() {
  if (this.isModified('advertiserId') || !this.advertiserName) {
    const advertiser = await connection.model('advertiser').findOne({ _id: this.advertiserId }, { name: 1 });
    this.advertiserName = advertiser.name;
  }
});

schema.pre('save', async function setReady() {
  const needs = await this.getRequirements();
  if (needs.length) {
    this.ready = false;
  } else {
    this.ready = true;
  }
});

schema.index({ advertiserId: 1 });
schema.index({ name: 1, _id: 1 }, { unique: true });
schema.index({ name: -1, _id: -1 }, { unique: true });
schema.index({ updatedAt: 1, _id: 1 }, { unique: true });
schema.index({ updatedAt: -1, _id: -1 }, { unique: true });

// Query logic for campaign retrieval.
schema.index({
  status: 1,
  'criteria.start': 1,
  'criteria.placementIds': 1,
  'criteria.end': 1,
});

module.exports = schema;
