const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
//const sanitizeHtml = require('sanitize-html');

//Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.status(401).json({ error: 'You must be logged in to post a comment!' });
    }
};

// Route to handle comment creation
router.post('/', isAuthenticated, async (req, res) => {
    try {
        console.log('Received comment creation request:', req.body);
        const { postId, content, parentCommentId } = req.body;

        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u'],
            allowedAttributes: {}
        });

        const newComment = new Comment({
            user: req.user.id,
            post: postId,
            content: sanitizedContent,
            parent: parentCommentId || null
        });

        console.log('Saving new comment:', newComment);
        await newComment.save();

        if (parentCommentId) {
            console.log('Updating parent comment:', parentCommentId);
            await Comment.findByIdAndUpdate(parentCommentId, {
                $push: { replies: newComment._id }
            });
        } else {
            console.log('Updating post:', postId);
            await Post.findByIdAndUpdate(postId, {
                $push: { comments: newComment._id }
            });
        }

        console.log('Populating user data for new comment');
        await newComment.populate('user', 'username profilePictureUrl');

        console.log('Sending success response');
        res.status(200).json({ success: true, comment: newComment });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Error creating comment', details: error.message });
    }
});



module.exports = router;