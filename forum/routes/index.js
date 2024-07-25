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
// Home route
router.get('/', async (req, res) => {
    try {
        const isLoggedIn = !!req.user;
        const limit = isLoggedIn ? 0 : 15;

        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments')
            .sort('-createdAt')
            .limit(limit)
            .lean();

        if (isLoggedIn && req.user._id) {
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts ? req.user.bookmarkedPosts.map(id => id.toString()) : [];
            posts.forEach(post => {
                post.userVote = post.upvotes && post.upvotes.some(id => id.toString() === userId) ? 'upvote' : 
                                post.downvotes && post.downvotes.some(id => id.toString() === userId) ? 'downvote' : null;
                post.isBookmarked = userBookmarks.includes(post._id.toString());
            });
        }

        res.render('pages/home', { 
            title: 'Home', 
            posts,
            isLoggedIn,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).render('pages/error', { title: 'Server Error', message: 'Error fetching posts' });
    }
});

/**
 * Retrieves and renders a single post
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
            .lean();

        if (!post) {
            return res.status(404).render('error', { 
                title: 'Post Not Found', 
                message: 'The requested post could not be found.',
                user: req.user
            });
        }

        const isLoggedIn = !!req.user;
        if (isLoggedIn && req.user._id) {
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts ? req.user.bookmarkedPosts.map(id => id.toString()) : [];
            post.userVote = post.upvotes.some(id => id.toString() === userId) ? 'upvote' : 
                            post.downvotes.some(id => id.toString() === userId) ? 'downvote' : null;
            post.isBookmarked = userBookmarks.includes(post._id.toString());
        }

        const postUserId = post.user._id.toString();
        const currentUserId = req.user ? (req.user._id || req.user.id).toString() : null;
        const isAuthor = currentUserId === postUserId;

        res.render('pages/post', { 
            title: post.title, 
            post,
            user: req.user,
            isAuthor,
            isLoggedIn
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
router.get('/saved', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'bookmarkedPosts',
                populate: { path: 'user', select: 'username avatar' }
            })
            .lean();

        const posts = user.bookmarkedPosts.map(post => ({
            ...post,
            isBookmarked: true,
            userVote: post.upvotes.some(id => id.toString() === req.user._id.toString()) ? 'upvote' : 
                      post.downvotes.some(id => id.toString() === req.user._id.toString()) ? 'downvote' : null
        }));

        res.render('saved-pages', { 
            title: 'Saved Posts',
            posts, 
            user: req.user,
            isLoggedIn: true
        });
    } catch (error) {
        console.error('Error fetching saved posts:', error);
        res.status(500).render('error', { message: 'Error fetching saved posts' });
    }
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

// Upvote a post
router.post('/post/:id/upvote', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const userId = req.user._id;
        const hasUpvoted = post.upvotes.includes(userId);
        const hasDownvoted = post.downvotes.includes(userId);

        if (hasUpvoted) {
            // Remove upvote
            post.upvotes.pull(userId);
        } else {
            // Add upvote
            post.upvotes.addToSet(userId);
            // Remove downvote if exists
            if (hasDownvoted) {
                post.downvotes.pull(userId);
            }
        }

        await post.save();
        res.json({ 
            upvotes: post.upvotes.length, 
            downvotes: post.downvotes.length,
            userVote: hasUpvoted ? null : 'upvote'
        });
    } catch (error) {
        console.error('Error upvoting post:', error);
        res.status(500).json({ error: 'Error upvoting post' });
    }
});

// Downvote a post
router.post('/post/:id/downvote', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const userId = req.user._id;
        const hasUpvoted = post.upvotes.includes(userId);
        const hasDownvoted = post.downvotes.includes(userId);

        if (hasDownvoted) {
            // Remove downvote
            post.downvotes.pull(userId);
        } else {
            // Add downvote
            post.downvotes.addToSet(userId);
            // Remove upvote if exists
            if (hasUpvoted) {
                post.upvotes.pull(userId);
            }
        }

        await post.save();
        res.json({ 
            upvotes: post.upvotes.length, 
            downvotes: post.downvotes.length,
            userVote: hasDownvoted ? null : 'downvote'
        });
    } catch (error) {
        console.error('Error downvoting post:', error);
        res.status(500).json({ error: 'Error downvoting post' });
    }
});

// Book a post
router.post('/post/:id/bookmark', isAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const isBookmarked = user.bookmarkedPosts.includes(postId);

        if (isBookmarked) {
            // Remove bookmark
            user.bookmarkedPosts.pull(postId);
        } else {
            // Add bookmark
            user.bookmarkedPosts.push(postId);
        }

        await user.save();

        res.json({ 
            isBookmarked: !isBookmarked,
            message: isBookmarked ? 'Post unbookmarked' : 'Post bookmarked'
        });
    } catch (error) {
        console.error('Error bookmarking post:', error);
        res.status(500).json({ error: 'Error bookmarking post' });
    }
});

/**
 * Trending route - displays posts sorted by upvotes
 * @route GET /trending
 */
router.get('/trending', async (req, res) => {
    try {
        const isLoggedIn = !!req.user;

        const posts = await Post.aggregate([
            {
                $addFields: {
                    upvoteCount: { $size: { $ifNull: ["$upvotes", []] } }
                }
            },
            { $sort: { upvoteCount: -1, createdAt: -1 } }
        ]).exec();

        const populatedPosts = await Post.populate(posts, [
            { path: 'user', select: 'username avatar' },
            { path: 'comments' }
        ]);

        if (isLoggedIn && req.user._id) {
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts ? req.user.bookmarkedPosts.map(id => id.toString()) : [];
            populatedPosts.forEach(post => {
                post.userVote = (post.upvotes && post.upvotes.some(id => id.toString() === userId)) ? 'upvote' : 
                                (post.downvotes && post.downvotes.some(id => id.toString() === userId)) ? 'downvote' : null;
                post.isBookmarked = userBookmarks.includes(post._id.toString());
            });
        }

        res.render('pages/trending', { 
            title: 'Trending', 
            posts: populatedPosts,
            isLoggedIn,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching trending posts:', error);
        res.status(500).render('pages/error', { title: 'Server Error', message: 'Error fetching trending posts' });
    }
});

/**
 * API route to fetch trending posts
 * @route GET /api/trending
 * @param {number} req.query.page - Page number 
 */
router.get('/api/trending', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 15;
        const skip = (page - 1) * limit;

        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments')
            .sort('-upvotes.length') // Sort by number of upvotes in descending order
            .skip(skip)
            .limit(limit);

        res.json(posts);
    } catch (error) {
        console.error('Error fetching trending posts for API:', error);
        res.status(500).json({ error: 'Error fetching trending posts' });
    }
});

module.exports = router;