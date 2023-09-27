const { Router } = require('express');
const { ACCOUNT_KEY } = require('../env');
const noCacheEvents = require('../middleware/no-cache-events');
const newrelic = require('../newrelic');
const analyticsService = require('../services/analytics');

const emptyGif = Buffer.from('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

const router = Router();
router.use(noCacheEvents());

const noticeError = (err) => {
  const error = new Error(`Analytics error for account ${ACCOUNT_KEY}: ${err.message}`);
  error.originalError = err;
  newrelic.noticeError(error);
};

const send = (res, status, err) => {
  if (err) {
    noticeError(err);
  }
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Content-Type', 'image/gif');

  res.status(status);
  res.send(emptyGif);
};

const trackEvent = (req, res) => {
  const { action } = req.params;
  // Track the event, but don't await so the response is fast.
  analyticsService.trackAction({
    action,
    fields: req.query,
    ua: req.get('User-Agent'),
    ip: req.ip,
  }).catch(noticeError);
  send(res, 200);
};

router.get('/:action.gif', trackEvent);
router.post('/:action.gif', trackEvent);

module.exports = router;
