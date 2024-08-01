/**
 * Main application file for the Forum Application
 * This file sets up the Express server, connects to MongoDB,
 * configures middleware, and sets up routes.
 */

require('dotenv').config();

const express = require('express');
const { create } = require('express-handlebars');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();

// Environment variables
const dbName = process.env.DB_NAME || 'Forum';
const mongoURI = process.env.MONGODB_URI || `mongodb://localhost:27017/${dbName}`;
const sessionSecret = process.env.SESSION_SECRET || 'ccapdev-secret-key';
const PORT = process.env.PORT || 3000;

/**
 * Connects to MongoDB and tests the connection
 */
async function connectToDatabase() {
    try {
        await mongoose.connect(mongoURI);
        console.log(`Connected to MongoDB: ${dbName}`);
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}
/**
 * Tests the database connection by creating and deleting a test document
 */
async function testDatabaseConnection() {
    try {
        const TestModel = mongoose.model('Test', new mongoose.Schema({ name: String }));
        const testDoc = new TestModel({ name: 'Test Connection' });
        await testDoc.save();
        console.log('Test document created successfully');
        await TestModel.findOneAndDelete({ name: 'Test Connection' });
        console.log('Test document deleted successfully');
        console.log('Database connection test completed successfully');
    } catch (error) {
        console.error('Database connection test failed:', error);
    }
}

/**
 * Loads all model files from the models directory
 */
function loadModels() {
    const modelsPath = path.join(__dirname, 'models');
    fs.readdirSync(modelsPath).forEach(file => {
        if (file.endsWith('.js')) {
            require(path.join(modelsPath, file));
        }
    });
}

// Handlebars setup
const hbs = create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        formatDate: (date) => new Date(date).toLocaleString(),
        eq: (v1, v2) => v1 === v2,
        subtract: function(a, b) { return a - b; },
        json: (context) => JSON.stringify(context),
        truncate: (str, len) => {
            if (str.length > len && str.length > 0) {
                let new_str = str + " ";
                new_str = str.substr(0, len);
                new_str = str.substr(0, new_str.lastIndexOf(" "));
                return (new_str.length > 0) ? new_str + '...' : str.substr(0, len) + '...';
            }
            return str;
        },
        truncateHtml: function(html, length) {
            if (!html) return '';
            // Remove HTML tags
            const strippedHtml = html.replace(/<[^>]+>/g, '');
            // Truncate the text
            if (strippedHtml.length > length) {
                return strippedHtml.substring(0, length) + '...';
            }
            return strippedHtml;
        },
        join: function(array, separator) {
            if (!Array.isArray(array)) return '';
            return array.join(separator);
        }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
});

// View engine setup
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/pages')
]);

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    } 
}));

// User context middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    req.user = req.session.user || null;
    console.log('Current user:', res.locals.user);  // For debugging
    next();
});

app.use((req, res, next) => {
    req.session.touch();
    next();
});

// Import routes
const indexRoutes = require('./routes/index');
const { router: authRoutes, authMiddleware } = require('./routes/authRoutes');
const createPostRouter = require('./routes/createPost');
const searchRoutes = require('./routes/searchRoutes');

// Apply authentication middleware
app.use(authMiddleware);

// Use routes
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', createPostRouter);
app.use('/', searchRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { title: 'Server Error', error: err });
});

/**
 * Starts the server and initializes the application
 */
async function startServer() {
    await connectToDatabase();
    loadModels();
    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Start the server
startServer().catch(console.error);