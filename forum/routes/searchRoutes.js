const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

router.get('/search', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    try {
        const query = req.query.q;
        const tag = req.query.tag;
        const isLoggedIn = !!req.user;

        let searchCriteria = {};
        let searchType = '';

        if (query) {
            searchCriteria = {
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { content: { $regex: query, $options: 'i' } }
                ]
            };
            searchType = 'query';
        } else if (tag) {
            searchCriteria = { tags: { $in: [tag] } };
            searchType = 'tag';
        } else {
            return res.render('search-results', { results: [], query: '', searchType: '' });
        }

        const results = await Post.find(searchCriteria)
            .populate('user', 'username profilePicture')
            .sort('-createdAt')
            .limit(20)
            .lean();

        if (isLoggedIn && req.user) {
            const userId = req.user._id.toString();
            const userBookmarks = req.user.bookmarkedPosts || [];
            results.forEach(post => {
                post.userVote = post.upvotes && post.upvotes.includes(userId) ? 'upvote' : 
                                post.downvotes && post.downvotes.includes(userId) ? 'downvote' : null;
                post.isBookmarked = userBookmarks.some(id => id.toString() === post._id.toString());
            });
        } else {
            results.forEach(post => {
                post.userVote = null;
                post.isBookmarked = false;
            });
        }

        res.render('search-results', { 
            results, 
            query: query || tag, 
            searchType,
            isLoggedIn,
            user: req.user
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).render('error', { message: 'An error occurred while searching' });
    }
});

module.exports = router;