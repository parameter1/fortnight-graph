const { paginationResolvers } = require('@limit0/mongoose-graphql-pagination');
const moment = require('moment');
const CreativeService = require('../../services/campaign-creatives');
const analytics = require('../../services/analytics');
const campaignDelivery = require('../../services/campaign-delivery');
const contactNotifier = require('../../services/contact-notifier');
const {
  Advertiser,
  Campaign,
  Story,
  Contact,
  Publisher,
  Image,
  Placement,
  User,
  EmailLineItem,
} = require('../../models');

const getNotifyDefaults = async (advertiserId, user) => {
  const advertiser = await Advertiser.strictFindById(advertiserId);
  const internal = await advertiser.get('notify.internal');
  const external = await advertiser.get('notify.external');

  const notify = {
    internal: internal.filter(c => !c.deleted),
    external: external.filter(c => !c.deleted),
  };
  const contact = await Contact.getOrCreateFor(user);
  notify.internal.push(contact.id);
  return notify;
};

module.exports = {
  /**
   *
   */
  Campaign: {
    advertiser: campaign => Advertiser.findById(campaign.advertiserId),
    notify: async (campaign) => {
      const internal = await Contact.find({
        _id: { $in: campaign.notify.internal },
        deleted: false,
      });
      const external = await Contact.find({
        _id: { $in: campaign.notify.external },
        deleted: false,
      });
      return { internal, external };
    },
    hash: campaign => campaign.pushId,
    story: campaign => Story.findById(campaign.storyId),
    requires: campaign => campaign.getRequirements(),
    primaryImage: (campaign) => {
      const imageIds = campaign.creatives.filter(cre => cre.active).map(cre => cre.imageId);
      if (!imageIds[0]) return null;
      return Image.findById(imageIds[0]);
    },
    publishers: async (campaign, { pagination, sort }) => {
      const placementIds = campaign.get('criteria.placementIds');
      const publisherIds = await Placement.distinct('publisherId', { _id: { $in: placementIds }, deleted: false });
      const criteria = { _id: { $in: publisherIds } };
      return Publisher.paginate({ pagination, criteria, sort });
    },
    emailLineItems: async (campaign, { pagination, sort }) => {
      const criteria = { campaignId: campaign.id };
      return EmailLineItem.paginate({ pagination, criteria, sort });
    },
    metrics: campaign => analytics.retrieveMetrics({ cid: campaign._id }),
    reports: campaign => campaign,
    creatives: campaign => campaign.creatives.filter(cre => !cre.deleted),
    createdBy: campaign => User.findById(campaign.createdById),
    updatedBy: campaign => User.findById(campaign.updatedById),
  },

  /**
   *
   */
  CampaignReportByDay: {
    day: ({ day }, { format }) => moment(day).format(format),
  },

  /**
   *
   */
  CampaignReports: {
    byDay: (campaign, { startDate, endDate }) => {
      const criteria = { cid: campaign._id };
      return analytics.runCampaignByDayReport(criteria, { startDate, endDate });
    },
  },

  CampaignCriteria: {
    placements: criteria => Placement.find({ _id: criteria.get('placementIds') }),
  },

  CampaignCreative: {
    image: creative => Image.findById(creative.imageId),
    linkText: creative => creative.linkText || null,
    metrics: creative => analytics
      .retrieveMetrics({ cre: creative._id, cid: creative.campaignId }),
    reports: creative => creative,
  },

  /**
   *
   */
  CampaignCreativeReports: {
    byDay: (creative, { startDate, endDate }) => {
      const criteria = { cre: creative._id, cid: creative.campaignId };
      return analytics.runCampaignByDayReport(criteria, { startDate, endDate });
    },
  },

  /**
   *
   */
  CampaignConnection: paginationResolvers.connection,

  /**
   *
   */
  Query: {
    /**
     *
     */
    campaign: (root, { input }, { auth }) => {
      auth.check();
      const { id } = input;
      return Campaign.strictFindActiveById(id);
    },

    /**
     *
     */
    campaignCreative: (root, { input }, { auth }) => {
      const { campaignId, creativeId } = input;
      auth.checkCampaignAccess(campaignId);
      return CreativeService.findFor(campaignId, creativeId);
    },

    /**
     *
     */
    campaignHash: async (root, { input }, { auth }) => {
      const { advertiserId, hash } = input;
      const campaign = await Campaign.strictFindActiveOne({ advertiserId, pushId: hash });
      auth.checkCampaignAccess(campaign.id);
      return campaign;
    },

    /**
     *
     */
    allCampaigns: (root, { pagination, sort }, { auth }) => {
      auth.check();
      const criteria = { deleted: false };
      return Campaign.paginate({ criteria, pagination, sort });
    },

    /**
     *
     */
    searchCampaigns: (root, { pagination, phrase }, { auth }) => {
      auth.check();
      const filter = { term: { deleted: false } };
      return Campaign.search(phrase, { pagination, filter });
    },

    /**
     *
     */
    runningCampaigns: (root, { pagination, sort }, { auth }) => {
      auth.check();
      const criteria = campaignDelivery.getDefaultCampaignCriteria();
      delete criteria.paused;
      return Campaign.paginate({ criteria, pagination, sort });
    },

    /**
     *
     */
    campaignsStartingSoon: (root, { pagination, sort }, { auth }) => {
      auth.check();
      const start = moment().add(14, 'days').toDate();
      const criteria = {
        deleted: false,
        'criteria.start': { $gte: new Date(), $lte: start },
      };
      return Campaign.paginate({ criteria, pagination, sort });
    },

    /**
     *
     */
    campaignsEndingSoon: (root, { pagination, sort }, { auth }) => {
      auth.check();
      const end = moment().add(14, 'days').toDate();
      const criteria = {
        deleted: false,
        ready: true,
        'criteria.end': { $gte: new Date(), $lte: end },
      };
      return Campaign.paginate({ criteria, pagination, sort });
    },

    /**
     *
     */
    incompleteCampaigns: (root, { pagination, sort }, { auth }) => {
      auth.check();
      const now = new Date();
      const criteria = {
        deleted: false,
        ready: false,
        $and: [
          {
            $or: [
              { 'criteria.end': { $exists: false } },
              { 'criteria.end': null },
              { 'criteria.end': { $gt: now } },
            ],
          },
        ],
      };
      return Campaign.paginate({ criteria, pagination, sort });
    },
  },

  /**
   *
   */
  Mutation: {
    /**
     * Clones a campaign
     */
    cloneCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { id } = input;
      const doc = await Campaign.strictFindActiveById(id);
      return doc.clone(auth.user);
    },

    /**
     *
     */
    deleteCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { id } = input;
      const campaign = await Campaign.strictFindActiveById(id);
      campaign.setUserContext(auth.user);
      return campaign.softDelete();
    },

    pauseCampaign: async (root, { id, paused }, { auth }) => {
      auth.check();
      const campaign = await Campaign.strictFindActiveById(id);
      campaign.setUserContext(auth.user);
      campaign.paused = paused;
      return campaign.save();
    },

    /**
     *
     */
    createExternalUrlCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { name, advertiserId } = input;
      const notify = await getNotifyDefaults(advertiserId, auth.user);

      const campaign = new Campaign({
        name,
        advertiserId,
        criteria: {},
        notify,
      });
      campaign.setUserContext(auth.user);
      await campaign.save();

      contactNotifier.sendInternalCampaignCreated({ campaign });
      contactNotifier.sendExternalCampaignCreated({ campaign });
      return campaign;
    },

    /**
     *
     */
    createExistingStoryCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { name, storyId } = input;
      const story = await Story.strictFindActiveById(storyId);

      const { advertiserId } = story;
      const notify = await getNotifyDefaults(advertiserId, auth.user);

      const campaign = new Campaign({
        name,
        advertiserId,
        storyId,
        criteria: {},
        notify,
      });
      campaign.setUserContext(auth.user);

      campaign.creatives.push({
        title: story.title ? story.title.slice(0, 75) : undefined,
        teaser: story.teaser ? story.teaser.slice(0, 255) : undefined,
        imageId: story.primaryImageId,
        active: Boolean(story.title && story.teaser && story.imageId),
      });
      await campaign.save();

      contactNotifier.sendInternalCampaignCreated({ campaign });
      contactNotifier.sendExternalCampaignCreated({ campaign });
      return campaign;
    },

    /**
     *
     */
    createNewStoryCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { name, advertiserId, publisherId } = input;
      const notify = await getNotifyDefaults(advertiserId, auth.user);

      const story = new Story({
        title: 'Placeholder Story',
        advertiserId,
        publisherId,
        placeholder: true,
      });
      story.setUserContext(auth.user);
      await story.save();


      const campaign = new Campaign({
        name,
        storyId: story.id,
        advertiserId,
        criteria: {},
        notify,
      });
      campaign.setUserContext(auth.user);
      await campaign.save();

      contactNotifier.sendInternalCampaignCreated({ campaign });
      contactNotifier.sendExternalCampaignCreated({ campaign });
      return campaign;
    },

    /**
     *
     */
    updateCampaign: async (root, { input }, { auth }) => {
      auth.check();
      const { id, payload } = input;
      const campaign = await Campaign.strictFindActiveById(id);
      campaign.setUserContext(auth.user);
      campaign.set(payload);
      return campaign.save();
    },

    /**
     *
     */
    assignCampaignValue: async (root, { input }, { auth }) => {
      const { id, field, value } = input;
      const campaign = await Campaign.strictFindActiveById(id);

      if (auth.user) {
        campaign.setUserContext(auth.user);
      }
      campaign.set(field, value);
      return campaign.save();
    },

    /**
     *
     */
    campaignCriteria: async (root, { input }, { auth }) => {
      auth.check();
      const { campaignId, payload } = input;
      const campaign = await Campaign.strictFindActiveById(campaignId);
      campaign.setUserContext(auth.user);
      campaign.criteria = payload;
      await campaign.save();
      return campaign.criteria;
    },

    campaignUrl: async (root, { input }, { auth }) => {
      const { campaignId, url } = input;
      auth.checkCampaignAccess(campaignId);
      const campaign = await Campaign.strictFindActiveById(campaignId);
      campaign.setUserContext(auth.user);
      campaign.url = url;
      return campaign.save();
    },

    /**
     *
     */
    addCampaignCreative: (root, { input }, { auth }) => {
      const { campaignId, payload } = input;
      auth.checkCampaignAccess(campaignId);
      return CreativeService.createFor(campaignId, payload);
    },

    /**
     *
     */
    removeCampaignCreative: async (root, { input }, { auth }) => {
      const { campaignId, creativeId } = input;
      auth.checkCampaignAccess(campaignId);
      await CreativeService.removeFrom(campaignId, creativeId);
      return 'ok';
    },

    /**
     *
     */
    campaignCreativeStatus: async (root, { input }, { auth }) => {
      const { campaignId, creativeId, active } = input;
      auth.checkCampaignAccess(campaignId);
      return CreativeService.setStatusFor(campaignId, creativeId, active);
    },

    /**
     *
     */
    campaignCreativeDetails: async (root, { input }, { auth }) => {
      const { campaignId, creativeId, payload } = input;
      auth.checkCampaignAccess(campaignId);
      const {
        title,
        teaser,
        active,
        linkText,
      } = payload;
      return CreativeService.updateDetailsFor(campaignId, creativeId, {
        title,
        teaser,
        linkText,
        active,
      });
    },

    /**
     *
     */
    campaignCreativeImage: async (root, { input }, { auth }) => {
      const { campaignId, creativeId, imageId } = input;
      auth.checkCampaignAccess(campaignId);
      return CreativeService.updateImageFor(campaignId, creativeId, imageId);
    },

    /**
     *
     */
    campaignContacts: async (root, { input }, { auth }) => {
      auth.check();
      const { id, type, contactIds } = input;
      const field = `notify.${type}`;
      const campaign = await Campaign.strictFindActiveById(id);
      campaign.set(field, contactIds);
      campaign.setUserContext(auth.user);
      return campaign.save();
    },

    campaignExternalContact: async (root, { input }, { auth }) => {
      const { campaignId, payload } = input;
      const { email, givenName, familyName } = payload;
      auth.checkCampaignAccess(campaignId);
      const campaign = await Campaign.strictFindActiveById(campaignId);

      const contact = await Contact.findOneAndUpdate({ email, deleted: false }, {
        $set: {
          familyName,
          givenName,
          name: `${givenName} ${familyName}`,
        },
        $setOnInsert: { email, deleted: false },
      }, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      });

      if (auth.user) {
        campaign.setUserContext(auth.user);
      }
      campaign.get('notify.external').push(contact.id);
      return campaign.save();
    },

    removeCampaignExternalContact: async (root, { input }, { auth }) => {
      const { campaignId, contactId } = input;
      auth.checkCampaignAccess(campaignId);
      const campaign = await Campaign.strictFindActiveById(campaignId);

      campaign.removeExternalContactId(contactId);
      if (auth.user) {
        campaign.setUserContext(auth.user);
      }
      return campaign.save();
    },
  },
};
