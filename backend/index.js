const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const customerRoutes = require('./routes/customer.routes');
const productRoutes = require('./routes/product.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');

dotenv.config();

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

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

async function start() {
    try {
        if (!MONGO_URI || MONGO_URI.includes('<db_username>') || MONGO_URI.includes('<db_password>')) {
            throw new Error('Set MONGO_URI in backend/.env to your MongoDB Atlas connection string.');
        }

        await mongoose.connect(MONGO_URI);
        console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('MongoDB connection error:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

start();
