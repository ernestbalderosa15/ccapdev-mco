// npm init -y

require('dotenv').config();

const express = require('express');
const { create } = require('express-handlebars');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();


// Use environment variables
const dbName = process.env.DB_NAME || 'Forum';
const mongoURI = process.env.MONGODB_URI || `mongodb://localhost:27017/${dbName}`;
const sessionSecret = process.env.SESSION_SECRET || 'ccapdev-secret-key';

// Connect to MongoDB
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log(`Connected to MongoDB: ${dbName}`);
    testDatabaseConnection();
})
.catch((err) => console.error('MongoDB connection error:', err));

// Function to test database connection
async function testDatabaseConnection() {
    try {
        // Create a test model
        const TestModel = mongoose.model('Test', new mongoose.Schema({ name: String }));
        
        // Create a test document
        const testDoc = new TestModel({ name: 'Test Connection' });
        await testDoc.save();
        console.log('Test document created successfully');
        
        // Find and delete the test document
        await TestModel.findOneAndDelete({ name: 'Test Connection' });
        console.log('Test document deleted successfully');
        
        console.log('Database connection test completed successfully');
    } catch (error) {
        console.error('Database connection test failed:', error);
    }
}

// Load models
const modelsPath = path.join(__dirname, 'models');
fs.readdirSync(modelsPath).forEach(file => {
    if (file.endsWith('.js')) {
        require(path.join(modelsPath, file));
    }
});

// Set up Handlebars as the template engine
const hbs = create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        // Format the date
        formatDate: function(date) { 
            return new Date(date).toLocaleString();
        },
        // Check if equal
        eq: function (v1, v2) {
            return v1 === v2;
        },
        // Shorten content shown in feed
        truncate: function(str, len) {
            if (str.length > len && str.length > 0) {
                let new_str = str + " ";
                new_str = str.substr(0, len);
                new_str = str.substr(0, new_str.lastIndexOf(" "));
                new_str = (new_str.length > 0) ? new_str : str.substr(0, len);
                return new_str + '...';
            }
            return str;
        }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

// Set views directory
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/pages')
]);

// Middleware
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

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    console.log('Current user:', res.locals.user);  // For debugging
    next();
});

// Import routes
const indexRoutes = require('./routes/index');
const { router: authRoutes, authMiddleware } = require('./routes/authRoutes');



// Use routes
app.use('/', indexRoutes);
app.use('/', authRoutes);

app.use(authMiddleware);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { error: err });
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});