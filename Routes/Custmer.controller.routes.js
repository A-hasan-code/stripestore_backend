const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe");

// Route to create a new customer
router.post('/customers', async (req, res) => {
    const { email, name } = req.body;

    try {
        console.log(`Creating customer with email: ${email}, name: ${name}`);

        // Create a new customer in Stripe
        const customer = await stripe.customers.create({
            email,
            name,
        });

        console.log(`Customer created successfully: ${customer.id}`);

        res.status(201).json({
            message: 'Customer created successfully',
            customer,
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to list all customers along with their subscriptions and charges
router.get('/customers', async (req, res) => {
    try {
        const customerData = [];
        console.log("Fetching all customers...");

        await stripe.customers.list({ limit: 100 }) // Increased limit for testing
            .autoPagingEach(async (customer) => {
                console.log(`Fetched customer: ${customer.id}`);

                const subscriptions = await stripe.subscriptions.list({
                    customer: customer.id,
                    status: 'all',
                });
                console.log(`Fetched subscriptions for customer ${customer.id}:`, subscriptions.data.length);

                const charges = await stripe.charges.list({
                    customer: customer.id,
                    limit: 10,
                });
                console.log(`Fetched charges for customer ${customer.id}:`, charges.data.length);

                customerData.push({
                    customer,
                    subscriptions: subscriptions.data,
                    charges: charges.data,
                });
            });

        res.status(200).json({
            message: 'Customers, subscriptions, and transactions fetched successfully',
            data: customerData,
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get a specific customer by ID
router.get('/customer/:id', async (req, res) => {
    const customerId = req.params.id;
    console.log(`Fetching details for customer ID: ${customerId}`);

    try {
        const customer = await stripe.customers.retrieve(customerId);
        console.log(`Fetched customer: ${customer.id}`);

        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
        });
        console.log(`Fetched subscriptions for customer ${customerId}:`, subscriptions.data.length);

        const charges = await stripe.charges.list({
            customer: customerId,
            limit: 10,
        });
        console.log(`Fetched charges for customer ${customerId}:`, charges.data.length);

        res.status(200).json({
            customer,
            subscriptions: subscriptions.data,
            charges: charges.data,
        });
    } catch (error) {
        console.error(`Error fetching customer with ID ${customerId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
