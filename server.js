require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const db = require('./config/db');
const Product = require('./Routes/Product.Controller.routes')
const UserRoutes = require('./Routes/User.conroller.routes');
const Custmer = require('./Routes/Custmer.controller.routes')
const checkout = require('./Routes/Checkout.controller.routes')
require('dotenv').config();

// Initialize Express app
const app = express();
const port = 3000 || process.env.Port;

// Define CORS options
const corsOptions = {
    origin: '*',
    credentials: true
};
const sessionStore = new MySQLStore({}, db);

// Configure session middleware
app.use(session({
    key: 'session_cookie_name', // Cookie name
    secret: process.env.SESSION_SECRET || 'your-secret', // Replace with your secret
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60, // 1 hour
    },
}));
console.log("JWT Secret: ", process.env.JWT_SECRET);
// Middleware setup
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/api', UserRoutes);
app.use('/api', Product)
app.use('/api', Custmer)
app.use('/api', checkout)
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
}));
// Basic route
app.get('/', (req, res) => {
    res.send('Express + MySQL Server is running!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
