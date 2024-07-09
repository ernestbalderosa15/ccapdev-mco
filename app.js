//Install Command:
//npm init -y
//npm i express express-handlebars body-parser mongoose express-session connect-flash
//npm install bcrypt jsonwebtoken nodemailer

const express = require("express");
const mongoose = require("mongoose");
const { MongoClient, ObjectId } = require("mongodb");
const server = express();
const path = require("path");

const bodyParser = require("body-parser");
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

const handlebars = require("express-handlebars");
const { Schema } = require("mongoose");
server.set("view engine", "hbs");
server.engine(
  "hbs",
  handlebars.engine({
    extname: "hbs",
  })
);

const uri =
"mongodb+srv://myrinetumbaga:4BCCefiV25OZDmMN@cluster0.uiczv67.mongodb.net/TheForum?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

let postColl;
let userColl;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to database");

    const db = client.db("TheForum");
    postColl = db.collection("posts");
    userColl = db.collection("users");


    // Start the server after database connection is established
    const port = process.env.PORT || 9090;
    server.listen(port, function () {
      console.log("Listening at port " + port);
    });
  } catch (e) {
    console.error(e);
  }
}

//server.use(express.static("public"));
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.static(path.join(__dirname, 'Pages')));

//SCHEMAS
const postSchema = new Schema({
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
});

const Post = mongoose.model("Post", postSchema);


const bcrypt = require('bcrypt');

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
});

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

//FUNCTIONS for feed posts.

server.get("/", async (req, res) => {
  try {
    const posts = await postColl.find().toArray();
    res.render("main", { layout: "index", post_data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

//create an upvote feature according to the main.hbs [TO FIX]
server.post("/upvote", async (req, res) => {
  const postId = req.body.postId;
  const userId = "user1"; // Example user ID, replace with actual user ID logic [TO FIX]
  
  try {
    const post = await postColl.findOne({ _id: postId });
    if (!post) {
      return res.status(404).send("Post not found");
    }

    let updatedPost;
    if (post.usersUpvoted.includes(userId)) {
      // User already upvoted, so remove their upvote
      updatedPost = await postColl.findOneAndUpdate(
        { _id: postId },
        { 
          $inc: { postUp: -1 },
          $pull: { usersUpvoted: userId }
        },
        { returnDocument: 'after' }
      );
    } else {
      // User hasn't upvoted yet, so add their upvote
      updatedPost = await postColl.findOneAndUpdate(
        { _id: postId },
        { 
          $inc: { postUp: 1 },
          $push: { usersUpvoted: userId }
        },
        { returnDocument: 'after' }
      );
    }

    if (!updatedPost.value) {
      return res.status(404).send("Failed to update post");
    }

    res.send({ success: true, postUp: updatedPost.value.postUp });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error upvoting post");
  }
});

server.get("/post/:id", async (req, res) => {
  const postId = req.params.id;
  
  try {
    const post = await postColl.findOne({ _id: postId });
    if (!post) {
      return res.status(404).send({ success: false, message: "Post not found" });
    }
    res.send({ success: true, post });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Error fetching post data" });
  }
});


//For internal purposes only [REMOVE]
server.get("/show-posts", async (req, res) => {
  try {
    const posts = await postColl.find().toArray();
    console.log(posts); // Log posts array to console
    posts.forEach((post) => {
      console.log("ID: ", post._id);
      
    })
    res.render("main", { layout: "index", post_data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

connectToDatabase().catch(console.dir);


// For login and register
const session = require('express-session');
const flash = require('connect-flash');

server.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: true
}));
server.use(flash());

// Middleware to make flash messages available to all templates
server.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
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
    
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      req.flash('error_msg', 'Username or email already in use');
      return res.redirect('/register');
    }
    
    const user = new User({ firstName, lastName, username, email, password });
    await user.save();
    
    req.flash('success_msg', 'You have successfully registered');
    res.redirect('/login');
  } catch (error) {
    console.error("Registration error:", error);
    req.flash('error_msg', 'Error registering user');
    res.redirect('/register');
  }
});

//SETTINGS ROUTE
server.get("/settings", (req, res) => {
  res.render("settings", {layout: "index"});
})

//CREATE POST ROUTE
server.get("/create-post", (req, res) => {
  res.render("createpost", {layout: "index"});
})

server.get("/profile", (req, res) => {
  res.render("profile", {layout: "index"});
})

//POST PAGE ROUTE
server.get("/post-page", (req, res) => {
  res.render("postPage", {layout: "index"});
})