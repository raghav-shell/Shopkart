const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { connectDatabase } = require('./config/database');
const customerRoutes = require('./routes/customer.routes');
const productRoutes = require('./routes/product.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json());
app.use(cookieParser());

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// Browser navigation and refreshes must load the React app, not a JSON API.
app.get(['/login', '/register', '/home', '/password', '/products', '/products/:productId', '/wishlist', '/cart', '/checkout', '/orders', '/orders/:id'], (req, res, next) => {
    if (!req.get('Accept')?.includes('text/html')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// Connect before authentication or any controller accesses a model.
app.use(['/api', '/customers', '/products', '/wishlist', '/cart', '/orders'], async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
        await connectDatabase();
        next();
    } catch (error) {
        console.error('Database connection failed:', error.name, error.code || '');
        res.status(503).json({ success: false, message: 'Database unavailable. Check server configuration and network access.' });
    }
});

app.get('/api/health', async (req, res, next) => {
    try {
        await mongoose.connection.db.admin().command({ ping: 1 });
        res.json({ success: true, database: 'connected' });
    } catch (error) {
        next(error);
    }
});

app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// Keep the Lab 05 API paths available to existing clients.
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('Request failed:', err.name, err.code || '');
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' && status >= 500
        ? 'Server error. Please try again.'
        : err.message || 'Server Error';
    res.status(status).json({ success: false, message });
});

const PORT = process.env.PORT || 5001;

async function start() {
    try {
        await connectDatabase();
        console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error('Startup failed:', error.name, error.code || '', 'Check MONGO_URI, JWT_SECRET, DNS, and Atlas network access.');
        process.exitCode = 1;
    }
}

// Local startup remains unchanged; Vercel imports the handler without listening.
if (require.main === module) start();
module.exports = app;
