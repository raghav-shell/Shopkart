const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

const originalEnv = { ...process.env };
after(() => { process.env = originalEnv; });

test('concurrent requests share a connection, warm requests reuse it, and failures can retry', async (t) => {
    process.env.MONGO_URI = 'mongodb://127.0.0.1/deployment_test';
    process.env.JWT_SECRET = 'test-secret';
    let attempts = 0;
    let finish;
    const connect = t.mock.method(mongoose, 'connect', () => {
        attempts += 1;
        return new Promise(resolve => { finish = resolve; });
    });
    const first = connectDatabase();
    const second = connectDatabase();
    assert.equal(attempts, 1);
    mongoose.connection.readyState = 1;
    finish(mongoose);
    await Promise.all([first, second]);
    await connectDatabase();
    assert.equal(attempts, 1);
    mongoose.connection.readyState = 0;
    connect.mock.mockImplementation(async () => { attempts += 1; throw new Error('Unavailable'); });
    await assert.rejects(connectDatabase(), /Unavailable/);
    await assert.rejects(connectDatabase(), /Unavailable/);
    assert.equal(attempts, 3);
});

test('production routing, health, JSON errors, and catalog write protection', async (t) => {
    process.env.NODE_ENV = 'production';
    delete process.env.PRODUCT_WRITE_KEY;
    const config = require('../config/database');
    let connectionFailure = false;
    t.mock.method(config, 'connectDatabase', async () => {
        if (connectionFailure) throw new Error('Private connection details');
        return mongoose;
    });
    const originalDb = mongoose.connection.db;
    const app = require('../../api/index');
    mongoose.connection.db = { admin: () => ({ command: async () => ({ ok: 1 }) }) };
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        mongoose.connection.db = originalDb;
        await new Promise(resolve => server.close(resolve));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await health.json(), { success: true, database: 'connected' });
    const unknown = await fetch(`${origin}/api/not-a-route`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get('content-type'), /application\/json/);
    for (const path of ['/api/products', '/products']) {
        const blocked = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(blocked.status, 403);
    }
    process.env.PRODUCT_WRITE_KEY = 'test-write-key';
    const Product = require('../models/product.model');
    t.mock.method(Product, 'create', async value => ({ _id: 'test-product', ...value }));
    const wrongKey = await fetch(`${origin}/api/products`, { method: 'POST', headers: { 'X-Product-Key': 'wrong' } });
    assert.equal(wrongKey.status, 403);
    const allowed = await fetch(`${origin}/api/products`, { method: 'POST', headers: { 'X-Product-Key': 'test-write-key', 'Content-Type': 'application/json' }, body: '{"name":"Sample"}' });
    assert.equal(allowed.status, 201);
    assert.equal((await allowed.json()).product.name, 'Sample');
    const protectedRoute = await fetch(`${origin}/api/customers/me`);
    assert.equal(protectedRoute.status, 401);
    mongoose.connection.db = { admin: () => ({ command: async () => { throw new Error('Contains private connection information'); } }) };
    const failed = await fetch(`${origin}/api/health`);
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).message, 'Server error. Please try again.');
    connectionFailure = true;
    const disconnected = await fetch(`${origin}/api/health`);
    assert.equal(disconnected.status, 503);
    const disconnectedBody = await disconnected.json();
    assert.equal(disconnectedBody.success, false);
    assert.doesNotMatch(disconnectedBody.message, /Private/);
});
