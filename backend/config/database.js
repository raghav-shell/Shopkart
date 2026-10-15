const mongoose = require('mongoose');

// Shared by requests in a warm function instance, including concurrent requests.
let connectionPromise;

async function connectDatabase() {
    const uri = process.env.MONGO_URI;
    if (!uri || /<[^>]+>/.test(uri)) {
        throw new Error('Set MONGO_URI to a valid MongoDB connection string.');
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_this_with_a_strong_secret') {
        throw new Error('Set JWT_SECRET to a strong secret.');
    }
    if (mongoose.connection.readyState === 1) return mongoose;
    if (!connectionPromise) {
        connectionPromise = mongoose.connect(uri, {
            maxPoolSize: 10,
            minPoolSize: 0,
            maxIdleTimeMS: 60000,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        }).then((result) => {
            connectionPromise = undefined;
            return result;
        }).catch((error) => {
            connectionPromise = undefined;
            throw error;
        });
    }
    return connectionPromise;
}

module.exports = { connectDatabase };
