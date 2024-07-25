/**
 * Authentication Routes
 * This module handles user authentication, including signup, login, and logout functionalities.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

// Rate limiting for account creation to prevent abuse
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many accounts created from this IP, please try again after an hour"
});

// Rate limiting for login attempts to prevent brute force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

// GET route for signup page
router.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up', layout: 'auth' });
});

// GET route for login page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login', layout: 'auth' });
});

// POST route for user signup
router.post('/signup', createAccountLimiter, [
    // Validation and sanitization of input
    body('username').trim().isLength({ min: 3 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password and create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ username, email, password: hashedPassword });
      await newUser.save();

      res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
});

// POST route for user login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        
        // Find user and check password
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Create JWT token
        const tokenExpiration = rememberMe ? '30d' : '1d';
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiration }
        );

        // Set user session
        req.session.user = { id: user._id, username: user.username, avatarId: user.avatarId };

        // Set token in cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
        });

        res.json({ message: 'Logged in successfully', userId: user._id, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Authentication Middleware
 * Checks for a valid JWT token in cookies or Authorization header
 */
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token || req.headers['authorization'];

    if (!token) {
        req.user = null;
        res.locals.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            _id: decoded.id,  
            id: decoded.id,   
            username: decoded.username
        };
        res.locals.user = req.user;
        next();
    } catch (error) {
        req.user = null;
        res.locals.user = null;
        res.clearCookie('token');
        next();
    }
};

// GET route for user logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = { router, authMiddleware };