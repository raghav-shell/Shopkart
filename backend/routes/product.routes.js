const express = require('express');
const crypto = require('crypto');
const productController = require('../controllers/product.controller');

const router = express.Router();

router.post('/', (req, res, next) => {
    const expected = process.env.PRODUCT_WRITE_KEY;
    if (process.env.NODE_ENV !== 'production' && !expected) return next();
    const supplied = req.get('X-Product-Key');
    if (!expected || !supplied) {
        return res.status(403).json({ success: false, message: 'Product creation is restricted.' });
    }
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
        return res.status(403).json({ success: false, message: 'Product creation is restricted.' });
    }
    next();
}, productController.create);
router.get('/', productController.list);
router.get('/:id', productController.getOne);

module.exports = router;