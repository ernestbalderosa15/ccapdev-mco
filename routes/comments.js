const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const sanitizeHtml = require('sanitize-html');

// Middleware to check if user is authenticated
// Improved middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('Session user:', req.session.user);

    if (req.isAuthenticated && req.isAuthenticated()) {
        console.log('User authenticated via Passport');
        return next();
    }

    if (req.session && (req.session.user || req.session.userId)) {
        console.log('User authenticated via session');
        req.user = req.session.user || { _id: req.session.userId };
        return next();
    }

    if (req.user) {
        console.log('User object present');
        return next();
    }

    console.log('Authentication failed');
    res.status(401).json({ error: 'You must be logged in to perform this action' });
};

// Route to add a comment
router.post('/comment', /*isAuthenticated,*/ async (req, res) => {
    try {
        const { postId, content, parentCommentId } = req.body;
        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u'],
            allowedAttributes: {}
        });

        const newComment = new Comment({
            user: req.user._id,
            post: postId,
            content: sanitizedContent,
            parent: parentCommentId || null
        });

        // Log all data in newComment
        console.log('New comment data:', {
            user: newComment.user,
            post: newComment.post,
            content: newComment.content,
            parent: newComment.parent,
            createdAt: newComment.createdAt,
            updatedAt: newComment.updatedAt,
        });
        
        await newComment.save();
        if (parentCommentId) {
            await Comment.findByIdAndUpdate(parentCommentId, {
                $push: { replies: newComment._id }
            });
        } else {
            await Post.findByIdAndUpdate(postId, {
                $push: { comments: newComment._id }
            });
        }
        await User.findByIdAndUpdate(req.user._id, {
            $push: { comments: newComment._id },
            $inc: { commentCount: 1 }
        });

        res.status(200).json({ success: true, comment: newComment });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Error adding comment', details: error.message });
    }
});

// Route to edit a comment
router.put('/comment/:commentId', isAuthenticated, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You are not authorized to edit this comment' });
        }

        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'br', 'strong', 'em', 'u'],
            allowedAttributes: {}
        });

        comment.content = sanitizedContent;
        comment.isEdited = true;
        comment.updatedAt = Date.now();

        await comment.save();

        res.status(200).json({ success: true, comment });
    } catch (error) {
        console.error('Error editing comment:', error);
        res.status(500).json({ error: 'Error editing comment', details: error.message });
    }
});

// Route to delete a comment
router.delete('/comment/:commentId', isAuthenticated, async (req, res) => {
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You are not authorized to delete this comment' });
        }

        // Remove comment from parent comment's replies if it's a reply
        if (comment.parent) {
            await Comment.findByIdAndUpdate(comment.parent, {
                $pull: { replies: commentId }
            });
        } else {
            // Remove comment from post if it's a top-level comment
            await Post.findByIdAndUpdate(comment.post, {
                $pull: { comments: commentId }
            });
        }

        // Remove comment from user's comments
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { comments: commentId },
            $inc: { commentCount: -1 }
        });

        // Delete the comment
        await Comment.findByIdAndDelete(commentId);

        res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Error deleting comment', details: error.message });
    }
});

module.exports = router;