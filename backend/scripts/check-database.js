const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

// This diagnostic never imports models or writes application data.
const deadline = setTimeout(() => {
    console.error('Database check timed out. Check DNS, Atlas Network Access, and outbound TCP connectivity.');
    process.exit(1);
}, 20000);

(async () => {
    try {
        await connectDatabase();
        const admin = mongoose.connection.db.admin();
        await admin.command({ ping: 1 });
        const hello = await admin.command({ hello: 1 });
        const transactionsSupported = Boolean(hello.setName) || hello.msg === 'isdbgrid';
        console.log(JSON.stringify({
            connected: true,
            database: mongoose.connection.name,
            ping: 'ok',
            transactionsSupported,
        }, null, 2));
        if (!transactionsSupported) {
            console.error('Checkout requires a replica set or sharded cluster.');
            process.exitCode = 1;
        }
    } catch (error) {
        // Do not print the URI, credentials, or raw driver diagnostics.
        console.error(JSON.stringify({ connected: false, error: error.name, code: error.code || null }));
        console.error('Check MONGO_URI, JWT_SECRET, DNS, Atlas database-user credentials, and Network Access.');
        process.exitCode = 1;
    } finally {
        clearTimeout(deadline);
        await mongoose.disconnect();
    }
})();
