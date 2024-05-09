module.exports = {
  /**
   *
   */
  readOnly(next, root, vars, { locked }) {
    return next().then((r) => {
      if (locked) throw new Error('This NativeX instance is inactive. Changes cannot be saved.');
      return r;
    });
  },
};
