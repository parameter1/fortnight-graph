const { titleize, underscore } = require('inflection');
const moment = require('moment-timezone');
const { GA_VIEW_ID, REPORTING_SERVICE_URL } = require('../env');
const { google, auth } = require('../connections/google');
const { serviceClient } = require('../utils');

const { isArray } = Array;
// The timezone that the GA view is configured
const VIEW_TZ = 'America/Chicago';
const GA4_START_DATE = new Date('2023-07-01T00:00:00-05:00');
let conn;
const reportingClient = serviceClient({ url: REPORTING_SERVICE_URL });

module.exports = {
  /**
   *
   */
  reportingClient,

  async connect() {
    if (!conn) {
      conn = google.analyticsreporting({
        version: 'v4',
        auth: await auth(['https://www.googleapis.com/auth/analytics']),
      });
    }
    return conn;
  },

  /**
   *
   * @param {string} storyId
   * @param {object} params
   * @param {string|Date} params.startDate
   * @param {string|Date} params.endDate
   * @param {string|Date} params.quotaUser The quota user value, for rate-limiting
   */
  async storyReportByDay(storyId, { startDate, endDate, quotaUser }) {
    if (!storyId) throw new Error('No story ID was provided.');
    const dateRanges = [this.formatDates({ startDate, endDate })];
    const dimensions = [{ name: 'ga:date' }];
    const dimensionFilterClauses = [
      { filters: [this.getStoryFilter(storyId)] },
    ];

    const request = {
      viewId: GA_VIEW_ID,
      dateRanges,
      dimensions,
      metrics: this.getStandardMetrics(),
      dimensionFilterClauses,
      includeEmptyRows: true,
      hideTotals: true,
      hideValueRanges: true,
    };
    const data = await this.sendReportRequests(request, { quotaUser });
    return this.formatReport(data.reports[0], {
      date: v => moment(v),
    });
  },

  /**
   *
   */
  shouldUseGa4({ startDate, endDate }) {
    if (startDate <= GA4_START_DATE) return true;
    if (endDate >= GA4_START_DATE) return true;
    return false;
  },

  /**
   *
   */
  shouldUseUA({ startDate, endDate }) {
    if (endDate <= GA4_START_DATE) return true;
    if (startDate <= GA4_START_DATE) return true;
    return false;
  },

  /**
   *
   * @param {string} storyId
   * @param {object} params
   * @param {string|Date} params.startDate
   * @param {string|Date} params.endDate
   * @param {string|Date} params.quotaUser The quota user value, for rate-limiting
   */
  async storyReport(storyId, { startDate, endDate, quotaUser }) {
    if (!storyId) throw new Error('No story ID was provided.');
    const useGa4 = this.shouldUseGa4({ startDate, endDate });
    const useUA = this.shouldUseUA({ startDate, endDate });
    console.log('storyReport', { useGa4, useUA });

    const getUaMetrics = async () => {
      const dateRanges = [this.formatUADates({ startDate, endDate })];

      const dimensionFilterClauses = [
        { filters: [this.getStoryFilter(storyId)] },
      ];

      const request = {
        viewId: GA_VIEW_ID,
        dateRanges,
        metrics: this.getStandardMetrics(),
        dimensionFilterClauses,
        includeEmptyRows: true,
        hideTotals: true,
        hideValueRanges: true,
      };
      const data = await this.sendReportRequests(request, { quotaUser });
      const rows = this.formatReport(data.reports[0]);
      return rows[0];
    };

    const getGA4Metrics = async () => {
      const report = await this.reportingClient.request('storyReport', { storyId, startDate, endDate });
      const rows = this.formatReportGA4(report);
      return rows[0];
    };

    const merge = async (uap, gap) => {
      const ua = await uap;
      const ga = await gap;
      const metrics = Object.keys(ua.metrics).reduce((o, k) => {
        const uav = ua.metrics[k] || 0;
        const gav = ga.metrics[k] || 0;
        let v = uav + gav;
        // Average if both datasets have values, or else use whichever one has a value.
        // eslint-disable-next-line no-mixed-operators
        if (/^avg/.test(k)) v = (gav > 0 < uav) ? v / 2 : (uav || gav);
        return { ...o, [k]: v };
      }, {});
      console.log('storyReport', { ua: ua.metrics, ga4: ga.metrics, merged: metrics });
      return { metrics };
    };

    if (!useGa4) return getUaMetrics();
    if (!useUA) return getGA4Metrics();
    return merge(getUaMetrics(), getGA4Metrics());
  },

  /**
   *
   * @param {string} storyId
   * @param {object} params
   * @param {string|Date} params.startDate
   * @param {string|Date} params.endDate
   * @param {string|Date} params.quotaUser The quota user value, for rate-limiting
   */
  async storyAcquisitionReport(storyId, { startDate, endDate, quotaUser }) {
    if (!storyId) throw new Error('No story ID was provided.');
    const dateRanges = [this.formatDates({ startDate, endDate })];
    const dimensions = [{ name: 'ga:channelGrouping' }];
    const dimensionFilterClauses = [
      { filters: [this.getStoryFilter(storyId)] },
    ];

    const request = {
      viewId: GA_VIEW_ID,
      dateRanges,
      dimensions,
      metrics: this.getStandardMetrics(),
      dimensionFilterClauses,
      includeEmptyRows: true,
      hideTotals: true,
      hideValueRanges: true,
    };
    const data = await this.sendReportRequests(request, { quotaUser });
    return this.formatReport(data.reports[0]);
  },

  /**
   *
   * @param {string} storyId
   * @param {object} params
   * @param {string|Date} params.startDate
   * @param {string|Date} params.endDate
   * @param {string|Date} params.quotaUser The quota user value, for rate-limiting
   */
  async storyDeviceReport(storyId, { startDate, endDate, quotaUser }) {
    if (!storyId) throw new Error('No story ID was provided.');
    const dateRanges = [this.formatDates({ startDate, endDate })];
    const dimensions = [{ name: 'ga:deviceCategory' }];
    const dimensionFilterClauses = [
      { filters: [this.getStoryFilter(storyId)] },
    ];

    const request = {
      viewId: GA_VIEW_ID,
      dateRanges,
      dimensions,
      metrics: this.getStandardMetrics(),
      dimensionFilterClauses,
      includeEmptyRows: true,
      hideTotals: true,
      hideValueRanges: true,
    };
    const data = await this.sendReportRequests(request, { quotaUser });
    return this.formatReport(data.reports[0]);
  },

  formatReportGA4(report, formatters = {}) {
    const dimensionEntries = (report.dimensionHeaders || [])
      .map(name => this.createKeyGA4(name));
    const metricHeaderEntries = (report.metricHeaders || [])
      .map(o => ({ ...o, key: this.createKeyGA4(o.name) }));
    const rows = report.rows || [];

    return rows.reduce((arr, { dimensionValues, metricValues }) => {
      arr.push({
        ...dimensionValues.reduce((obj, value, index) => {
          const key = dimensionEntries[index];
          const fn = formatters[key];
          return { ...obj, [key]: this.formatValue(value, fn) };
        }, {}),
        metrics: metricValues.reduce((obj, { value }, index) => {
          const { key } = metricHeaderEntries[index];
          return { ...obj, [key]: Number(value) };
        }, {}),
      });
      return arr;
    }, []);
  },

  formatReport(report, formatters = {}) {
    const { columnHeader } = report;

    const dimensionEntries = (columnHeader.dimensions || [])
      .map(name => this.createKey(name));
    const metricHeaderEntries = (columnHeader.metricHeader.metricHeaderEntries || [])
      .map(o => ({ ...o, key: this.createKey(o.name) }));
    const rows = report.data.rows || [];

    return rows.reduce((arr, row) => {
      const dimensions = row.dimensions || [];
      arr.push({
        ...dimensions.reduce((obj, value, index) => {
          const key = dimensionEntries[index];
          const fn = formatters[key];
          return { ...obj, [key]: this.formatValue(value, fn) };
        }, {}),
        metrics: row.metrics[0].values.reduce((obj, value, index) => {
          const { key } = metricHeaderEntries[index];
          return { ...obj, [key]: Number(value) };
        }, {}),
      });
      return arr;
    }, []);
  },

  formatValue(value, fn) {
    if (typeof fn === 'function') return fn(value);
    return value;
  },

  createLabel(name) {
    return titleize(underscore(this.createKey(name)));
  },

  createKeyGA4(name) {
    const map = new Map([
      ['screenPageViews', 'pageviews'],
      // ga:uniquePageviews
      ['sessions', 'sessions'],
      ['totalUsers', 'users'],
      ['averageSessionDuration', 'avgSessionDuration'],
      ['bounceRate', 'bouncerate'],
      // ga:timeOnPage
      ['userEngagementDuration', 'avgTimeOnPage'],
      ['countCustomEvent:ua_metric_1', 'shares'],
    ]);
    return map.get(name) || name;
  },

  createKey(name) {
    const map = {
      metric1: 'shares',
    };
    const key = name.replace(/^ga:/, '');
    return map[key] ? map[key] : key;
  },

  /**
   *
   * @param {array|object} requests An array of report request objects, or a single object.
   * @param {?object} params Additional query parameters to send with the request.
   */
  async sendReportRequests(requests, params) {
    const api = await this.connect();
    const reportRequests = isArray(requests) ? requests : [requests];
    const res = await api.reports.batchGet({
      requestBody: { reportRequests },
    }, { params });
    // console.log('sendReportRequests', res.data);
    return res.data;
  },

  formatDates({ startDate, endDate }) {
    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    };
  },

  formatUADates({ startDate, endDate }) {
    const maxStart = moment(startDate).isAfter(GA4_START_DATE) ? GA4_START_DATE : startDate;
    const maxEnd = moment(endDate).isBefore(GA4_START_DATE) ? endDate : GA4_START_DATE;
    return {
      startDate: this.formatDate(maxStart),
      endDate: this.formatDate(maxEnd),
    };
  },

  formatGA4Dates({ startDate, endDate }) {
    const minStart = moment(startDate).isBefore(GA4_START_DATE) ? GA4_START_DATE : startDate;
    const minEnd = moment(endDate).isAfter(GA4_START_DATE) ? endDate : GA4_START_DATE;
    return {
      startDate: this.formatDate(minStart),
      endDate: this.formatDate(minEnd),
    };
  },

  formatDate(date) {
    if (!date) return undefined;
    return moment(date).tz(VIEW_TZ).startOf('day').format('YYYY-MM-DD');
  },

  getStoryFilter(storyId) {
    return {
      dimensionName: 'ga:dimension2',
      operator: 'EXACT',
      expressions: [storyId],
    };
  },

  getStandardMetrics() {
    return [
      { expression: 'ga:pageviews' },
      { expression: 'ga:uniquePageviews' },
      { expression: 'ga:sessions' },
      { expression: 'ga:users' },
      { expression: 'ga:avgSessionDuration' },
      { expression: 'ga:bounceRate' },
      { expression: 'ga:timeOnPage' },
      { expression: 'ga:avgTimeOnPage' },
      { expression: 'ga:metric1' },
    ];
  },

  getDefaultMetricValues() {
    return this.getStandardMetrics().reduce((obj, metric) => {
      const key = this.createKey(metric.expression);
      return { ...obj, [key]: 0 };
    }, {});
  },
};
