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
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure multer for file uploads

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

// Home route
router.get('/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    next();
}, async (req, res) => {
    try {
        const isLoggedIn = !!req.user;
        console.log('Is user logged in:', isLoggedIn);
        console.log('User object:', req.user);

        const limit = isLoggedIn ? 0 : 15;

        const posts = await Post.find()
            .populate('user', 'username profilePicture')
            .populate('comments')
            .sort('-createdAt')
            .limit(limit)
            .lean({ virtuals: true });

        if (isLoggedIn && req.user._id) {
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts ? req.user.bookmarkedPosts.map(id => id.toString()) : [];
            posts.forEach(post => {
                post.userVote = (post.upvotes && post.upvotes.some(id => id.toString() === userId)) ? 'upvote' : 
                                (post.downvotes && post.downvotes.some(id => id.toString() === userId)) ? 'downvote' : null;
                post.isBookmarked = userBookmarks.includes(post._id.toString());
            });
        }

        res.render('pages/home', { 
            title: 'Home', 
            posts,
            isLoggedIn,
            user: req.user
        });
        console.log('Rendered home page with user:', req.user);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).render('pages/error', { title: 'Server Error', message: 'Error fetching posts' });
    }
});

// Post route
router.get('/post/:id', async (req, res) => {
    try {
        console.log('Fetching post with ID:', req.params.id);
        const post = await Post.findById(req.params.id)
            .populate({
                path: 'user',
                select: 'username profilePicture profilePictureUrl'
            })
            .populate({
                path: 'comments',
                populate: [
                    { path: 'user', select: 'username profilePicture' },
                    { 
                        path: 'replies',
                        populate: { path: 'user', select: 'username profilePicture' }
                    }
                ]
            })
            .lean();

        console.log('Post fetched:', post ? 'Yes' : 'No');

        if (!post) {
            console.log('Post not found');
            return res.status(404).render('error', { 
                title: 'Post Not Found', 
                message: 'The requested post could not be found.',
                user: req.user
            });
        }

        console.log('Post user:', post.user);

        const isLoggedIn = !!req.user;
        console.log('Is user logged in:', isLoggedIn);
        
        let isAuthor = false;
        
        if (isLoggedIn) {
            console.log('Logged in user ID:', req.user._id);
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts ? req.user.bookmarkedPosts.map(id => id.toString()) : [];
            
            if (post.upvotes && Array.isArray(post.upvotes)) {
                post.userVote = post.upvotes.some(id => id.toString() === userId) ? 'upvote' : 
                                (post.downvotes && Array.isArray(post.downvotes) && post.downvotes.some(id => id.toString() === userId)) ? 'downvote' : null;
            } else {
                console.log('Post upvotes is not an array:', post.upvotes);
                post.userVote = null;
            }
            
            post.isBookmarked = userBookmarks.includes(post._id.toString());
            isAuthor = post.user && post.user._id && (post.user._id.toString() === userId);
        } else {
            post.userVote = null;
            post.isBookmarked = false;
        }

        console.log('Rendering post page');
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

// My Interests route
router.get('/my-interests', isAuthenticated, (req, res) => {
    res.render('my-interests', { title: 'My Interests', user: req.user });
});

// Saved Pages route
router.get('/saved', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'bookmarkedPosts',
                populate: { path: 'user', select: 'username profilePicture' }
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

// Profile route
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

// Settings
router.get('/settings', isAuthenticated, (req, res) => {
    res.render('settings', { title: 'Settings', user: req.user });
});

// Is user authorized to edit post
function isAuthorized(post, user) {
    if (!user || !user._id || !post.user._id) return false;
    return post.user._id.toString() === (user._id || user.id).toString();
}

// Edit post route
router.get('/edit-post/:id', isAuthenticated, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).lean();
        if (!post) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Post not found', user: req.user });
        }

        if (!isAuthorized(post, req.user)) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'You are not authorized to edit this post', user: req.user });
        }

        res.render('edit-post', { title: 'Edit Post', post, user: req.user });
    } catch (error) {
        console.error('Error fetching post for edit:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Error fetching post for editing' });
    }
});

// Update post route
router.post('/update-post/:id', isAuthenticated, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Post not found', user: req.user });
        }

        if (!isAuthorized(post, req.user)) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'You are not authorized to update this post', user: req.user });
        }

        post.title = req.body.title;
        post.content = req.body.content;
        await post.save();

        res.redirect(`/post/${post._id}`);
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Error updating post' });
    }
});

// Update user profile route
// Update user profile route
router.post('/profile/update', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
        const { username, email, country, aboutMe, currentPassword, newPassword, confirmNewPassword, tags } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).render('error', { title: 'Not Found', message: 'User not found', user: req.user });
        }

        if (currentPassword && newPassword) {
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).render('settings', { title: 'Settings', user: req.user, error: 'Current password is incorrect' });
            }

            if (newPassword !== confirmNewPassword) {
                return res.status(400).render('settings', { title: 'Settings', user: req.user, error: 'New passwords do not match' });
            }

            user.password = await User.hashPassword(newPassword);
        }

        if (req.file) {
            user.profilePicture = req.file.path;
        }
        
        user.username = username || user.username;
        user.email = email || user.email;
        user.country = country || user.country;
        user.aboutMe = aboutMe || user.aboutMe;

        if (tags) {
            user.savedTags = JSON.parse(tags); // Update savedTags
        }

        await user.save();

        res.json({ success: true, message: 'Profile updated successfully!' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile. Please try again.' });
    }
});


module.exports = router;
