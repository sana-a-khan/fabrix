const request = require('supertest');
const { expect } = require('chai');
const app = require('./server'); // Assuming your server file exports the app

describe('Auth Endpoints', () => {
  let server;
  before((done) => {
    server = app.listen(4000, done);
  });

  after((done) => {
    server.close(done);
  });

  // Add delay between tests to avoid Supabase rate limiting
  afterEach((done) => {
    setTimeout(done, 1000);
  });

  const randomEmail = `test-${Math.random().toString(36).substring(7)}@gmail.com`;
  const password = 'password123';

  it('should sign up a new user', (done) => {
    request(server)
      .post('/auth/signup')
      .send({ email: randomEmail, password: password })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('token');
        expect(res.body.user).to.have.property('id');
        expect(res.body.user.email).to.equal(randomEmail);
        done();
      });
  });

  it('should not sign up an existing user', (done) => {
    request(server)
      .post('/auth/signup')
      .send({ email: randomEmail, password: password })
      .expect(400)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.include('already registered');
        done();
      });
  });

  it('should not sign up with an invalid email', (done) => {
    request(server)
      .post('/auth/signup')
      .send({ email: 'invalid-email', password: password })
      .expect(400)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.equal('Valid email required');
        done();
      });
  });

  it('should not sign up with a short password', (done) => {
    const shortPasswordEmail = `test-${Math.random().toString(36).substring(7)}@example.com`;
    request(server)
      .post('/auth/signup')
      .send({ email: shortPasswordEmail, password: 'short' })
      .expect(400)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.equal('Password must be at least 8 characters');
        done();
      });
  });

  it('should sign in an existing user', (done) => {
    request(server)
      .post('/auth/signin')
      .send({ email: randomEmail, password: password })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('token');
        expect(res.body.user).to.have.property('id');
        expect(res.body.user.email).to.equal(randomEmail);
        done();
      });
  });

  it('should not sign in with an incorrect password', (done) => {
    request(server)
      .post('/auth/signin')
      .send({ email: randomEmail, password: 'wrongpassword' })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.equal('Invalid email or password');
        done();
      });
  });
});
