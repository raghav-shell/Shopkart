const crypto = require('crypto');
const mongoose = require('mongoose');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

const addressFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];

function validateAddress(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const address = {};
    for (const field of addressFields) {
        if (typeof value[field] !== 'string' || !value[field].trim()) return null;
        address[field] = value[field].trim();
    }
    if (!/^[0-9]{10}$/.test(address.phone) || !/^[0-9]{6}$/.test(address.pincode)) return null;
    return address;
}

function paymentKeys() {
    const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;
    return keyId?.startsWith('rzp_test_') && keySecret ? { keyId, keySecret } : null;
}

async function createRazorpayOrder({ amount, receipt, keyId, keySecret }) {
    const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR', receipt })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.id || body.amount !== amount) {
        throw new Error(body.error?.description || 'Unable to create a Razorpay test order.');
    }
    return body;
}

exports.createPaymentOrder = async (req, res, next) => {
    let pendingOrder;
    try {
        const shippingAddress = validateAddress(req.body?.shippingAddress);
        if (!shippingAddress) {
            return res.status(400).json({ success: false, message: 'Enter a valid shipping address, 10-digit phone and 6-digit pincode.' });
        }
        const customer = await Customer.findById(req.user._id);
        if (!customer?.cart?.length) {
            return res.status(400).json({ success: false, message: 'Your cart is empty.' });
        }
        const products = await Product.find({ _id: { $in: customer.cart.map(item => item.product) } });
        const byId = new Map(products.map(product => [product.id, product]));
        const items = [];
        let totalPaise = 0;
        for (const cartItem of customer.cart) {
            const product = byId.get(cartItem.product.toString());
            if (!product) {
                return res.status(400).json({ success: false, message: 'A product in your cart is no longer available. Remove it before checkout.' });
            }
            if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1 || cartItem.quantity > product.stock) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.` });
            }
            const pricePaise = Math.round(product.price * 100);
            if (!Number.isSafeInteger(pricePaise) || pricePaise < 1) {
                return res.status(400).json({ success: false, message: `Invalid price for ${product.name}.` });
            }
            totalPaise += pricePaise * cartItem.quantity;
            items.push({ product: product._id, name: product.name, price: pricePaise / 100, quantity: cartItem.quantity, image: product.image });
        }
        if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) {
            return res.status(400).json({ success: false, message: 'Order amount is invalid or below Razorpay’s minimum.' });
        }
        const keys = paymentKeys();
        if (!keys) {
            return res.status(503).json({ success: false, message: 'Razorpay Test Mode is not configured. Add test keys to backend/.env.' });
        }

        pendingOrder = await Order.create({ user: customer._id, items, shippingAddress, totalAmount: totalPaise / 100 });
        const razorpayOrder = await createRazorpayOrder({
            amount: totalPaise,
            receipt: pendingOrder.id,
            ...keys
        });
        pendingOrder.razorpayOrderId = razorpayOrder.id;
        await pendingOrder.save();
        res.status(201).json({
            success: true,
            shopKartOrderId: pendingOrder.id,
            razorpayOrderId: razorpayOrder.id,
            amount: totalPaise,
            currency: 'INR',
            key: keys.keyId
        });
    } catch (err) {
        if (pendingOrder && !pendingOrder.razorpayOrderId) {
            await Order.deleteOne({ _id: pendingOrder._id }).catch(() => {});
        }
        next(err);
    }
};

exports.verifyPayment = async (req, res, next) => {
    try {
        const { shopKartOrderId, razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
        if (!mongoose.isValidObjectId(shopKartOrderId) ||
            ![razorpayOrderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0)) {
            return res.status(400).json({ success: false, message: 'Invalid payment details.' });
        }
        const keys = paymentKeys();
        if (!keys) return res.status(503).json({ success: false, message: 'Razorpay Test Mode is not configured.' });
        const order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        if (!order.razorpayOrderId || order.razorpayOrderId !== razorpayOrderId) {
            return res.status(400).json({ success: false, message: 'Payment order does not match.' });
        }
        const expected = crypto.createHmac('sha256', keys.keySecret)
            .update(`${order.razorpayOrderId}|${paymentId}`).digest('hex');
        const validSignature = /^[a-f0-9]{64}$/i.test(signature) &&
            crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
        if (!validSignature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }
        if (order.paymentStatus === 'PAID') {
            if (order.razorpayPaymentId !== paymentId) {
                return res.status(409).json({ success: false, message: 'Order was paid with a different payment.' });
            }
            return res.json({ success: true, order });
        }

        const session = await mongoose.startSession();
        let confirmedOrder;
        try {
            await session.withTransaction(async () => {
                const current = await Order.findOne({ _id: order._id, user: req.user._id }).session(session);
                if (current.paymentStatus === 'PAID') {
                    if (current.razorpayPaymentId !== paymentId) throw new Error('Order was paid with a different payment.');
                    confirmedOrder = current;
                    return;
                }
                current.paymentStatus = 'PAID';
                current.status = 'PLACED';
                current.razorpayPaymentId = paymentId;
                await current.save({ session });
                const result = await Customer.updateOne({ _id: req.user._id }, { $set: { cart: [] } }, { session });
                if (result.matchedCount !== 1) throw new Error('Customer not found.');
                confirmedOrder = current;
            });
        } finally {
            await session.endSession();
        }
        res.json({ success: true, order: confirmedOrder });
    } catch (err) {
        next(err);
    }
};

exports.list = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID.' });
        }
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        res.json({ success: true, order });
    } catch (err) { next(err); }
};
