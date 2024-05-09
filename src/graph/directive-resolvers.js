module.exports = {
  /**
   *
   */
  readOnly(next, root, vars, { locked }) {
    if (locked) throw new Error('This NativeX instance is inactive. Changes cannot be saved.');
  },
};
