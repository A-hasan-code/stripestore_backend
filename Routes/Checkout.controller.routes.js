const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe");

// Checkout API
router.post("/create-checkout-session", async (req, res) => {
    const { products, email, recurring } = req.body;

    // Validate input
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Invalid product data" });
    }

    // Create or retrieve the customer
    let customer;
    try {
        const existingCustomers = await stripe.customers.list({ email });

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0]; // Use the first found customer
        } else {
            customer = await stripe.customers.create({
                email,
            });
        }
    } catch (error) {
        console.error("Error retrieving/creating customer:", error);
        return res.status(500).json({ error: "Internal Server Error while handling customer" });
    }

    // Prepare line items for Stripe
    const lineItems = products.map(product => ({
        price_data: {
            currency: "usd",
            product_data: {
                name: product.dish,
                images: [product.imgdata],
            },
            unit_amount: product.price * 100,
        },
        quantity: product.qnty,
    }));

    try {
        // Create a new checkout session
        const sessionParams = {
            payment_method_types: ["card"],
            customer: customer.id,
            line_items: lineItems,
            mode: recurring ? "subscription" : "payment",
            success_url: `http://localhost:5173/success`,
            cancel_url: `http://localhost:5173/cancel`,
        };

        if (recurring) {
            // If recurring, set up subscription-specific parameters
            sessionParams.subscription_data = {
                items: lineItems.map(item => ({
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: item.price_data.product_data.name,
                            images: item.price_data.product_data.images,
                        },
                        unit_amount: item.price_data.unit_amount,
                    },
                    quantity: item.quantity,
                })),
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        // Respond with the session ID
        return res.json({ id: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
