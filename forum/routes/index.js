/**
 * Main Router for Forum Application
 * This module handles the routing for the main pages of the forum application.
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { router: authRouter, authMiddleware } = require('./authRoutes');
const sanitizeHtml = require('sanitize-html');

// Use authentication routes
router.use('/', authRouter);

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Middleware to check if a user is authenticated
 */
const isAuthenticated = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.status(401).render('error', { message: 'You must be logged in to access this page' });
    }
};

/**
 * Home route - displays recent posts
 */
router.get('/', async (req, res) => {
    try {
        const isLoggedIn = req.user ? true : false;
        const limit = isLoggedIn ? 0 : 15; // 0 means no limit for logged-in users

        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments')
            .sort('-createdAt')
            .limit(limit);

        res.render('pages/home', { 
            title: 'Home', 
            posts,
            isLoggedIn,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('pages/error', { message: 'Error fetching posts' });
    }
});

router.get('/api/posts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;

        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching posts' });
    }
});

/**
 * Individual post page route
 */
router.get('/post/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'username avatar')
            .populate({
                path: 'comments',
                populate: [
                    { path: 'user', select: 'username avatar' },
                    { 
                        path: 'replies',
                        populate: { path: 'user', select: 'username avatar' }
                    }
                ]
            })
            .populate('upvotes', 'username');

        if (!post) {
            return res.status(404).render('error', { 
                title: 'Post Not Found', 
                message: 'The requested post could not be found.',
                user: req.user
            });
        }

        res.render('pages/post', { 
            title: post.title, 
            post,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('error', { 
            message: 'Error fetching post',
            user: req.user
        });
    }
});

/**
 * Route to render the create post form
 */
router.get('/create-post', isAuthenticated, (req, res) => {
    res.render('create-post', { title: 'Create Post', user: req.user });
});

/**
 * My Interests route
 */
router.get('/my-interests', isAuthenticated, (req, res) => {
    res.render('my-interests', { title: 'My Interests', user: req.user });
});

/**
 * Saved Pages route
 */
router.get('/saved', isAuthenticated, (req, res) => {
    res.render('saved', { title: 'Saved Pages', user: req.user });
});

/**
 * Profile route
 */
router.get('/profile/:username?', async (req, res) => {
    try {
        let username = req.params.username || (req.user ? req.user.username : null);
        
        if (!username) {
            return res.redirect('/login');
        }
        
        const user = await User.findOne({ username })
            .populate('posts')
            .populate('comments')
            .populate('friends')
            .lean();
        
        if (!user) {
            return res.status(404).render('error', { message: 'User not found' });
        }

        user.postCount = user.posts.length;
        user.profilePicture = user.profilePicture || '/images/default-avatar.jpg';

        const isOwnProfile = req.user && req.user.username === username;

        res.render('profile', { 
            title: isOwnProfile ? 'My Profile' : `${user.username}'s Profile`,
            user: user,
            isOwnProfile: isOwnProfile,
            layout: 'profile-layout' 
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Error fetching user profile' });
    }
});

/**
 * Settings route
 */
router.get('/settings', isAuthenticated, (req, res) => {
    res.render('settings', { title: 'Settings', user: req.user });
});

module.exports = router;