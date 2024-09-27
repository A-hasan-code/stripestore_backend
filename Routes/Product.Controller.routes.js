const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe"); // Your Stripe config file
const db = require("../config/db"); // Your DB config file
const multer = require("multer");
const path = require("path");

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify the directory for uploads
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the filename
    }
});

const upload = multer({ storage });

// Create a product in Stripe and store it in MySQL
router.post('/product', upload.array('images', 5), async (req, res) => {
    const { name, unit_amount, currency, recurring, description } = req.body;
    const images = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);

    try {
        // Create product in Stripe
        const stripeProduct = await stripe.products.create({ name, images, description });

        // Create price in Stripe
        const priceData = {
            unit_amount: unit_amount * 100, // Convert to smallest currency unit (cents)
            currency,
            product: stripeProduct.id,
            ...(recurring ? { recurring: { interval: 'month' } } : {}),
        };
        const stripePrice = await stripe.prices.create(priceData);

        // Store in MySQL
        await storeProductInDB(stripeProduct, [stripePrice], images);

        res.status(201).json({
            message: 'Product created successfully',
            data: {
                id: stripeProduct.id,
                name: stripeProduct.name,
                prices: stripePrice,
                images: images,
                description: stripeProduct.description,
            },
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all products from MySQL
router.get('/products', async (req, res) => {
    try {
        const products = await stripe.products.list();
        const productsWithPrices = await Promise.all(
            products.data.map(async (product) => {
                const prices = await stripe.prices.list({ product: product.id });
                await storeProductInDB(product, prices.data, product.images); // Ensure DB is updated
                return {
                    ...product,
                    prices: prices.data,
                };
            })
        );

        res.status(200).json({
            message: 'Products fetched successfully',
            data: productsWithPrices,
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single product by ID
router.get('/product/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const product = await stripe.products.retrieve(productId);
        const prices = await stripe.prices.list({ product: productId });

        const responseData = {
            id: product.id,
            name: product.name,
            images: product.images,
            prices: prices.data,
            description: product.description
        };

        res.status(200).json({
            message: 'Product fetched successfully',
            data: responseData,
        });
    } catch (error) {
        console.error(`Error fetching product with ID ${productId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a product in Stripe and MySQL
router.put('/product/:id', upload.array('images', 5), async (req, res) => {
    const productId = req.params.id;
    const { name, unit_amount, currency, recurring } = req.body;
    const images = req.files ? req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`) : [];

    try {
        // Update product in MySQL first
        await updateProductInDB(productId, { name, unit_amount, currency, recurring, images });

        // Fetch updated data from MySQL
        const productInDB = await getProductFromDB(productId);

        // Update product in Stripe
        const updatedProduct = await stripe.products.update(productId, { name, images, description });

        // Update price in Stripe
        const prices = await stripe.prices.list({ product: productId });
        if (prices.data.length > 0) {
            await stripe.prices.update(prices.data[0].id, {
                unit_amount: productInDB.unit_amount * 100,
                currency,
                ...(recurring ? { recurring: { interval: 'month' } } : {}),
            });
        }

        res.status(200).json({
            message: 'Product updated successfully',
            data: updatedProduct,
        });
    } catch (error) {
        console.error(`Error updating product with ID ${productId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Store product in MySQL
async function storeProductInDB(product, prices, images) {
    const productType = prices.some(price => price.recurring) ? 'recurring' : 'one_time';

    for (const price of prices) {
        await db.execute(
            `INSERT INTO products (stripe_id, name, type, unit_amount, currency, images) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE name=?, type=?, unit_amount=?, currency=?, images=?`,
            [
                product.id,
                product.name,
                productType,
                price.unit_amount / 100, // Convert back to original unit
                price.currency,
                JSON.stringify(images), // Store images as JSON string
                product.name,
                productType,
                price.unit_amount / 100, // Convert back to original unit
                price.currency,
                JSON.stringify(images),

            ]
        );
    }
}

// Update product in MySQL
async function updateProductInDB(productId, { name, unit_amount, currency, recurring, images }) {
    const productType = recurring ? 'recurring' : 'one_time';

    await db.execute(
        `UPDATE products SET name=?, type=?, unit_amount=?, currency=?, images=? 
         WHERE stripe_id=?`,
        [
            name,
            productType,
            unit_amount,
            currency,
            JSON.stringify(images),

            productId,
        ]
    );
}

// Get product from MySQL
async function getProductFromDB(productId) {
    const [rows] = await db.execute(
        `SELECT name, unit_amount, currency, images FROM products WHERE stripe_id=?`,
        [productId]
    );

    if (rows.length === 0) {
        throw new Error('Product not found in database');
    }

    return rows[0];
}

module.exports = router;
