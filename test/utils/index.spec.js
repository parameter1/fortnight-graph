const Utils = require('../../src/utils');

describe('utils', () => {
  it('should export an object with the utilities.', (done) => {
    expect(Utils).to.be.an('object').with.all.keys('uuid', 'cleanValues', 'randomBetween', 'serviceClient', 'isScalar');
    done();
  });
});
