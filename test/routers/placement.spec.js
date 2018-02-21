require('../connections');
const app = require('../../src/app');
const router = require('../../src/routers/placement');
const PlacementRepo = require('../../src/repositories/placement');
const TemplateRepo = require('../../src/repositories/template');
const CampaignPlacementRepo = require('../../src/repositories/campaign/placement');

const createPlacement = async () => {
  const results = await PlacementRepo.seed();
  return results.one();
}

const createTemplate = async () => {
  const results = await TemplateRepo.seed();
  return results.one();
}

describe('routers/placement', function() {
  before(async function() {
    await PlacementRepo.remove();
    await TemplateRepo.remove();
  });
  after(async function() {
    await PlacementRepo.remove();
    await TemplateRepo.remove();
  });

  it('should export a router function.', function(done) {
    expect(router).to.be.a('function');
    expect(router).itself.to.respondTo('use');
    done();
  });
  describe('GET /:pid.:ext', function() {
    let placement;
    let template;
    before(async function() {
      placement = await createPlacement();
      template = await createTemplate();
    });

    it('should return a 200 when valid with :ext of html.', function(done) {
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.html`)
        .query({ tid })
        .expect('Content-Type', /text\/html/)
        .expect(200)
        .end(done);
    });

    it('should return a 200 when valid with :ext of json.', function(done) {
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.json`)
        .query({ tid })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should return a 200 when valid with the cv and mv query string present (object-notated).', function(done) {
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.json?tid=${tid}&cv[foo]=bar&cv[key]=value&mv[foo]=bar&mv[key]=value`)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should return a 200 when valid with the cv and mv query string present (encoded string).', function(done) {
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.json?tid=${tid}&cv=foo%3Dbar%26key%3Dvalue&mv=foo%3Dbar%26key%3Dvalue`)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should return a 200 when valid with the cv and mv query string present (empty).', function(done) {
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.json?tid=${tid}&cv=&mv=`)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should return a 404 when no placement was found using :ext json.', function(done) {
      const pid = '507f1f77bcf86cd799439011';
      const tid = template.id;
      request(app).get(`/placement/${pid}.json`)
        .query({ tid })
        .expect('Content-Type', /json/)
        .expect((res) => {
          const { status, body } = res;
          expect(status).to.equal(404);
          expect(body).to.be.an('object').with.property('error').that.is.an('object');

          const { error } = body;
          expect(error).to.have.property('status', 404);
          expect(error).to.have.property('message');
        })
        .end(done);
    });

    it('should return a 404 when no placement was found using :ext html.', function(done) {
      const pid = '507f1f77bcf86cd799439011';
      const tid = template.id;
      request(app).get(`/placement/${pid}.html`)
        .query({ tid })
        .expect('Content-Type', /text\/html/)
        .expect((res) => {
          const { status, text } = res;
          expect(status).to.equal(404);
          expect(text).to.exist;
        })
        .end(done);
    });

    ['xml', 'htm', 'jsonp'].forEach((value) => {
      it(`should return a 400 when accessed with an invalid :ext of '${value}'`, function(done) {
        const pid = placement.id;
        const tid = template.id;
        request(app).get(`/placement/${pid}.${value}`)
          .query({ tid })
          .expect('Content-Type', /text\/html/)
          .expect((res) => {
            const { status, text } = res;
            expect(status).to.equal(400);
            expect(text).to.equal('The requested file extension is not supported. (400)');
          })
          .end(done);
      });
    });

    it('should return a 400 when no tid is provided.', function(done) {
      const pid = placement.id;
      const tid = ''
      request(app).get(`/placement/${pid}.html`)
        .query({ tid })
        .expect((res) => {
          const { status, text } = res;
          expect(status).to.equal(400);
          expect(text).to.equal('No template ID was provided. (400)');
        })
        .end(done);
    });

    it('should return a 500 (with an obfuscated error) when a fatal is encountered.', function(done) {
      const message = 'Some internal error';
      const stub = sinon.stub(CampaignPlacementRepo, 'findFor').rejects(new Error(message));
      const pid = placement.id;
      const tid = template.id;
      request(app).get(`/placement/${pid}.json`)
        .query({ tid })
        .expect('Content-Type', /json/)
        .expect((res) => {
          const { status, body } = res;
          expect(status).to.equal(500);
          expect(body).to.be.an('object').with.property('error').that.is.an('object');

          const { error } = body;
          expect(error).to.have.property('status', 500);
          expect(error).to.have.property('message').not.equal(message);
        })
        .end((err) => {
          stub.restore();
          done(err);
        });
    });
  });
});
