const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const sanitizeHtml = require('sanitize-html');
const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.user && req.user._id) {  // Check for req.user._id
        console.log('User authenticated:', req.user);
        next();
    } else {
        res.status(401).json({ error: 'You must be logged in to create a post' });
    }
};

// Route to render the create post form
router.get('/create-post', isAuthenticated, (req, res) => {
    res.render('create-post', { title: 'Create Post', user: req.user });
});

// Route to handle post creation
router.post('/create-post', isAuthenticated, async (req, res) => {
    try {
        const { title, content, tags } = req.body;

        // Ensure tags is an array
        const tagArray = Array.isArray(tags) ? tags : [];

        // Extract image URLs from the content
        const imageRegex = /<img[^>]+src="?([^"\s]+)"?\s*/gi;
        let match;
        let imageUrl = null;
        while ((match = imageRegex.exec(content)) !== null) {
            imageUrl = match[1];
            break; // We'll just use the first image found
        }

        // Sanitize the HTML content
        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
            allowedAttributes: {}
        });

        // Create a new post
        const newPost = new Post({
            user: req.user._id, // Use the user id from the session
            title: title,
            content: sanitizedContent,
            tags: tagArray,
            image: imageUrl // Save the image URL
        });
        // Save the post to the database
        await newPost.save();

        // Update user's posts array and increment post count
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $push: { posts: newPost._id },
                $inc: { postCount: 1 }
            },
            { new: true }
        );


        res.status(200).json({ success: true, _id: newPost._id });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Error creating post', details: error.message });
    }
});
module.exports = router;