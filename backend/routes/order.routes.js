const express = require('express');
const auth = require('../middlewares/auth.middleware');
const orders = require('../controllers/order.controller');

const router = express.Router();
router.use(auth);
router.post('/create-payment-order', orders.createPaymentOrder);
router.post('/verify-payment', orders.verifyPayment);
router.get('/', orders.list);
router.get('/:id', orders.getOne);

module.exports = router;
