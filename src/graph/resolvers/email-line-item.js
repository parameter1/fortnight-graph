const { paginationResolvers } = require('@limit0/mongoose-graphql-pagination');
const userAttributionFields = require('./user-attribution');
const { Campaign, EmailLineItem, EmailPlacement } = require('../../models');

module.exports = {
  /**
   *
   */
  EmailLineItem: {
    campaign: ({ campaignId }) => Campaign.findById(campaignId),
    placement: ({ emailPlacementId }) => EmailPlacement.findById(emailPlacementId),
    requires: lineItem => lineItem.getRequirements(),
    ...userAttributionFields,
  },

  /**
   *
   */
  EmailLineItemConnection: paginationResolvers.connection,

  /**
   *
   */
  Mutation: {
    /**
     *
     */
    createEmailLineItem: (_, { input }, { auth }) => {
      auth.check();
      const {
        name,
        campaignId,
        emailPlacementId,
        dates,
      } = input;

      const {
        type,
        start,
        end,
        days,
      } = dates;

      const doc = {
        name,
        campaignId,
        emailPlacementId,
        dates: { type },
      };

      if (type === 'range') {
        if (!start || !end) throw new Error('You must provide a start and end date.');
        doc.dates.start = start;
        doc.dates.end = end;
      }
      if (type === 'days') {
        if (!Array.isArray(days) || !days.length) throw new Error('You must provide an array of days.');
        doc.dates.days = days;
      }
      const lineItem = new EmailLineItem(doc);
      lineItem.setUserContext(auth.user);
      return lineItem.save();
    },

    /**
     *
     */
    deleteEmailLineItem: async (_, { input }, { auth }) => {
      auth.check();
      const { id } = input;
      const lineItem = await EmailLineItem.strictFindActiveById(id);
      lineItem.setUserContext(auth.user);
      await lineItem.softDelete();
      return 'ok';
    },

    /**
     *
     */
    emailLineItemDateDays: async (_, { input }, { auth }) => {
      auth.check();
      const { id, days } = input;
      const doc = await EmailLineItem.strictFindActiveById(id);
      doc.setUserContext(auth.user);
      doc.set({
        dates: {
          type: 'days',
          days,
          start: undefined,
          end: undefined,
        },
      });
      return doc.save();
    },

    /**
     *
     */
    emailLineItemDateRange: async (_, { input }, { auth }) => {
      auth.check();
      const { id, start, end } = input;
      const doc = await EmailLineItem.strictFindActiveById(id);
      doc.setUserContext(auth.user);
      doc.set({
        dates: {
          type: 'range',
          days: undefined,
          start,
          end,
        },
      });
      return doc.save();
    },

    /**
     *
     */
    emailLineItemDetails: async (_, { input }, { auth }) => {
      auth.check();
      const { id, name, emailPlacementId } = input;
      const doc = await EmailLineItem.strictFindActiveById(id);
      doc.setUserContext(auth.user);
      doc.set({
        name,
        emailPlacementId,
      });
      return doc.save();
    },
  },

  /**
   *
   */
  Query: {
    /**
     *
     */
    emailLineItem: (_, { input }, { auth }) => {
      auth.check();
      const { id } = input;
      return EmailLineItem.strictFindActiveById(id);
    },
  },
};
