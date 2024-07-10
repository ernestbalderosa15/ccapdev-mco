const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const handlebars = require("express-handlebars");

const server = express();

// Handlebars setup
const hbs = handlebars.create({
  extname: "hbs",
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  }
});

server.engine("hbs", hbs.engine);
server.set("view engine", "hbs");

// Middleware
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.static(path.join(__dirname, 'Pages')));
server.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: true
}));
server.use(flash());

server.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Database connection
const uri = "mongodb+srv://myrinetumbaga:4BCCefiV25OZDmMN@cluster0.uiczv67.mongodb.net/TheForum?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // 5 second timeout
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB:', err));

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

console.log("Server starting...", new Date().toISOString());

// Schemas and Models
const postSchema = new mongoose.Schema({
  _id: String,
  authorImg: String,
  author: String,
  postDate: String,
  postTitle: String,
  postImg: String,
  postTags: Array,
  postUp: Number,
  postDown: Number,
  postComCount: Number,
  postSaved: Boolean,
  usersUpvoted: Array,
}, { collection: 'posts' });

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userImg: { type: String, default: 'default-profile-image.jpg' },
  userPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  userComments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  userTags: [String],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  friendList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { collection: 'users' });

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Routes

//display main page
server.get("/", async (req, res) => {
  try {
    //get posts from db
    console.log("Attempting to fetch posts from database...");
    const posts = await Post.find().lean();
    console.log("Raw posts from database:", posts);

    //check if there are posts
    if (!posts || posts.length === 0) {
      console.log("No posts found in the database.");
      return res.render("main", { layout: "index", post_data: [], debug_msg: "No posts found in the database." });
    }

    const formattedPosts = posts.map(post => ({
      ...post,
      postTags: Array.isArray(post.postTags) ? post.postTags : [],
      postSaved: Boolean(post.postSaved)
    }));
    console.log("Formatted posts:", formattedPosts);

    //display feed
    res.render("main", { layout: "index", post_data: formattedPosts, debug_msg: `Found ${formattedPosts.length} posts.` });
  } catch (err) {
    console.error("Error in main route:", err);
    res.status(500).render("main", { layout: "index", post_data: [], debug_msg: "Error fetching posts: " + err.message });
  }
});

//upvote function
server.post("/upvote", async (req, res) => {
  const postId = req.body.postId;
  const userId = "user1"; // Example user ID, replace with actual user ID logic [TO FIX]
  
  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const index = post.usersUpvoted.indexOf(userId);
    if (index > -1) {
      // User already upvoted, so remove their upvote
      post.usersUpvoted.splice(index, 1);
      post.postUp -= 1;
    } else {
      // User hasn't upvoted yet, so add their upvote
      post.usersUpvoted.push(userId);
      post.postUp += 1;
    }

    await post.save();
    res.json({ success: true, postUp: post.postUp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error upvoting post" });
  }
});

//expand post from main page
server.get("/post/:id", async (req, res) => {
  const postId = req.params.id;
  
  try {
    const post = await Post.findById(postId).lean();
    if (!post) {
      return res.status(404).send({ success: false, message: "Post not found" });
    }
    const formattedPost = {
      ...post,
      postTags: Array.isArray(post.postTags) ? post.postTags : [],
      postSaved: Boolean(post.postSaved)
    };
    res.send({ success: true, post: formattedPost });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Error fetching post data" });
  }
});

server.get("/db-check", async (req, res) => {
  try {
    const count = await Post.countDocuments();
    res.send(`Database connection successful. There are ${count} posts in the database.`);
  } catch (err) {
    console.error("Database check error:", err);
    res.status(500).send("Error connecting to database: " + err.message);
  }
});

server.get("/login", (req,res) => {
  res.render("login", {layout: false});
});

server.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/login');
    }
    const isMatch = await user.comparePassword(password);
    if (isMatch) {
      req.session.userId = user._id; // Set user ID in session
      return res.redirect('/');
    } else {
      req.flash('error_msg', 'Invalid password');
      return res.redirect('/login');
    }
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error logging in');
    res.redirect('/login');
  }
});

server.get("/register", (req, res) => {
  res.render("register", {layout: false});
});

server.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, confirmPassword } = req.body;
    
    if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
      req.flash('error_msg', 'All fields are required');
      return res.redirect('/register');
    }
    
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/register');
    }
    
    console.log('Attempting to find existing user');
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    console.log('Existing user check complete');
    
    if (existingUser) {
      req.flash('error_msg', 'Username or email already in use');
      return res.redirect('/register');
    }
    
    console.log('Creating new user');
    const user = new User({ firstName, lastName, username, email, password });
    await user.save();
    console.log('New user saved successfully');
    
    req.flash('success_msg', 'You have successfully registered');
    res.redirect('/login');
  } catch (error) {
    console.error("Registration error:", error);
    console.error("Error stack:", error.stack);
    req.flash('error_msg', 'Error registering user');
    res.redirect('/register');
  }
});

server.get("/settings", (req, res) => {
  res.render("settings", {layout: "index"});
});

server.get("/create-post", (req, res) => {
  res.render("createpost", {layout: "index"});
});

server.get("/profile", (req, res) => {
  res.render("profile", {layout: "index"});
});

server.get("/post-page", (req, res) => {
  res.render("postPage", {layout: "index"});
});

server.get("/about", (req, res) => {
  res.render("about", {layout: "index"});
})

// Start the server
const port = process.env.PORT || 9090;
server.listen(port, function () {
  console.log("Listening at port " + port);
});