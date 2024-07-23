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
 * @route GET /
 */
router.get('/', async (req, res) => {
    try {
        const isLoggedIn = !!req.user;
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
        console.error('Error fetching posts for home page:', error);
        res.status(500).render('pages/error', { title: 'Server Error', message: 'Error fetching posts' });
    }
});

/**
 * API route to fetch posts
 * @route GET /api/posts
 * @param {number} req.query.page - Page number 
 */
router.get('/api/posts', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
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
        console.error('Error fetching posts for API:', error);
        res.status(500).json({ error: 'Error fetching posts' });
    }
});

/**
 * Retrieves and renders a single post with its comments and author information.
 * 
 * @route GET /post/:id
 * @param {string} req.params.id - The ID of the post to retrieve.
 * @param {Object} req.user - The current authenticated user (if any).
 * @returns {void} Renders the post page or an error page.
 */
router.get('/post/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'username avatar _id')
            .populate({
                path: 'comments',
                populate: [
                    { path: 'user', select: 'username avatar _id' },
                    { 
                        path: 'replies',
                        populate: { path: 'user', select: 'username avatar _id' }
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

        const postUserId = post.user._id.toString();
        const currentUserId = req.user ? (req.user._id || req.user.id).toString() : null;
        const isAuthor = currentUserId === postUserId;

        res.render('pages/post', { 
            title: post.title, 
            post,
            user: req.user,
            isAuthor
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'An error occurred while fetching the post. Please try again later.',
            user: req.user
        });
    }
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
 * @route GET /profile/:username?
 * @param {string} req.params.username - Optional username to view profile (if not provided, shows current user's profile)
 */
router.get('/profile/:username?', async (req, res) => {
    try {
        const username = req.params.username || (req.user ? req.user.username : null);
        
        if (!username) {
            return res.redirect('/login');
        }
        
        const user = await User.findOne({ username })
            .populate('posts')
            .populate('comments')
            .populate('friends')
            .lean();
        
        if (!user) {
            return res.status(404).render('error', { title: 'Not Found', message: 'User not found' });
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
        console.error('Error fetching user profile:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Error fetching user profile' });
    }
});


/**
 * Settings route
 */
router.get('/settings', isAuthenticated, (req, res) => {
    res.render('settings', { title: 'Settings', user: req.user });
});

/**
 * Checks if the current user is authorized to modify the given post.
 * @param {Object} post - The post to check.
 * @param {Object} user - The current user.
 * @returns {boolean} True if authorized, false otherwise.
 */
function isAuthorized(post, user) {
    if (!user || !user._id || !post.user._id) return false;
    return post.user._id.toString() === (user._id || user.id).toString();
}

/**
 * Renders the edit post form.
 * @route GET /edit-post/:id
 * @param {string} req.params.id - The ID of the post to edit.
 */
router.get('/edit-post/:id', isAuthenticated, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('user', 'username _id');
        if (!post) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Post not found', user: req.user });
        }

        if (!isAuthorized(post, req.user)) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'You are not authorized to edit this post', user: req.user });
        }

        res.render('edit-post', { title: 'Edit Post', post, user: req.user });
    } catch (error) {
        console.error('Error fetching post for editing:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Error fetching post', user: req.user });
    }
});

/**
 * Handles the post update.
 * @route POST /edit-post/:id
 * @param {string} req.params.id - The ID of the post to update.
 * @param {Object} req.body - The updated post data.
 */
router.post('/edit-post/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, content, tags } = req.body;
        const post = await Post.findById(req.params.id).populate('user', 'username _id');

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!isAuthorized(post, req.user)) {
            return res.status(403).json({ error: 'You are not authorized to edit this post' });
        }

        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
            allowedAttributes: {}
        });

        post.title = title;
        post.content = sanitizedContent;
        post.tags = Array.isArray(tags) ? tags : [];

        await post.save();

        res.status(200).json({ success: true, _id: post._id });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Error updating post' });
    }
});

/**
 * Deletes a post.
 * @route DELETE /delete-post/:id
 * @param {string} req.params.id - The ID of the post to delete.
 */
router.delete('/delete-post/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('user', 'username _id');

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!isAuthorized(post, req.user)) {
            return res.status(403).json({ error: 'You are not authorized to delete this post' });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Error deleting post' });
    }
});


module.exports = router;