const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');

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
            .populate('comments')
            .sort('-createdAt')
            .limit(20)
            .lean();

        let user = null;
        if (isLoggedIn && req.user) {
            user = await User.findById(req.user._id)
                .populate('posts')
                .select('username profilePicture savedTags posts bookmarkedPosts')
                .lean();

            user.numberOfPosts = user.posts ? user.posts.length : 0;
            delete user.posts;

            user.profilePictureUrl = user.profilePicture || '/images/default-avatar.jpg';

            const userId = req.user._id.toString();
            const userBookmarks = user.bookmarkedPosts ? user.bookmarkedPosts.map(id => id.toString()) : [];
            results.forEach(post => {
                post.userVote = (post.upvotes && post.upvotes.some(id => id.toString() === userId)) ? 'upvote' : 
                                (post.downvotes && post.downvotes.some(id => id.toString() === userId)) ? 'downvote' : null;
                post.isBookmarked = userBookmarks.includes(post._id.toString());
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
            user: user
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).render('error', { message: 'An error occurred while searching' });
    }
});

module.exports = router;