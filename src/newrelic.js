require('./env');
const newrelic = require('newrelic');
const { ACCOUNT_KEY } = require('./env.js');

newrelic.addCustomAttribute({ accountKey: ACCOUNT_KEY });

module.exports = newrelic;
