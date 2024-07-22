const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { 
    type: String, 
    default: '/images/default-avatar.jpg' 
  },
  country: { type: String, default: '' },
  aboutMe: { type: String, default: '' },
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  upvotedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  savedTags: [{ type: String }],
  bookmarkedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.virtual('numberOfPosts').get(function() {
  return this.posts ? this.posts.length : 0;
});

module.exports = mongoose.model('User', userSchema);