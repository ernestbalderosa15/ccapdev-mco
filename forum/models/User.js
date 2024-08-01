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
  postCount: { type: Number, default: 0 },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedTags: [{ type: String }],
  bookmarkedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

userSchema.virtual('profilePictureUrl').get(function() {
  return this.profilePicture || '/images/default-avatar.jpg';
});

// Middleware to ensure profilePicture is always set
userSchema.pre('save', function(next) {
  if (!this.profilePicture) {
    this.profilePicture = '/images/default-avatar.jpg';
  }
  next();
});

userSchema.virtual('numberOfPosts').get(function() {
  return this.posts ? this.posts.length : 0;
});

userSchema.methods.getPostCount = async function() {
  return await mongoose.model('Post').countDocuments({ user: this._id });
};

module.exports = mongoose.model('User', userSchema);