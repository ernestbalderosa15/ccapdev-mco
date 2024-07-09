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
  "mongodb+srv://ernestbalderosa:pAuGvXMwMsmYkQeL@cluster0.hhgoid5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

let postColl;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to database");

    const db = client.db("TheForum");
    postColl = db.collection("posts");

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


const userSchema = new Schema({
  _id: String,
  userImg: String,
  username: String,
  name: String,
  password: String, //[TO FIX - need to add more logic here to hash the password]
  userPosts: Array, //ARRAY OF POSTS
  userComments: Array, //ARRAY OF COMMENTS
  userTags: Array, //ARRAY OF STRINGS
  savedPosts: Array, //ARRAY OF POSTS
  friendList: Array //ARRAY OF USERS
})

const User = mongoose.model("User", userSchema);

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


//LOGIN ROUTE
server.get("/login", (req,res) => {
  res.render("login", {layout: false});
});


//REGISTER ROUTE
server.get("/register", (req, res) => {
  res.render("register", {layout: false});
})


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

server.get("/post-page", (req, res) => {
  res.render("postPage", {layout: "index"});
})