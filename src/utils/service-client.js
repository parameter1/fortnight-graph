const fetch = require('node-fetch');

class HttpError extends Error {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

const createError = (code, message, original) => {
  const err = new HttpError(message);
  err.statusCode = code;
  err.originalError = original;
  return err;
};

module.exports = ({
  url,
  headers: globalHeaders,
  parse = JSON.parse,
  stringify = JSON.stringify,
} = {}) => {
  if (!url) throw createError(500, 'No service URL was provided.');

  return Object.create({
    /**
     *
     */
    async request(action, params = {}, {
      meta = {},
      headers = {},
      fetchOptions = {},
    } = {}) {
      const body = { action, params, meta };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...globalHeaders,
          ...headers,
          'content-type': 'application/json',
        },
        body: stringify(body),
        ...fetchOptions,
      });
      const text = await res.text();
      const parsed = parse(text);
      if (!res.ok) throw createError(res.status, parsed.message);
      return parsed.data;
    },
  });
};
