const express = require("express");
const mongoose = require("mongoose");
const { MongoClient, ObjectId } = require("mongodb");
const server = express();

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

server.use(express.static("public"));

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

server.get("/", async (req, res) => {
  try {
    const posts = await postColl.find().toArray();
    res.render("main", { layout: "index", post_data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

//For internal purposes only [REMOVE]
server.get("/show-posts", async (req, res) => {
  try {
    const posts = await postColl.find().toArray();
    console.log(posts); // Log posts array to console
    res.render("main", { layout: "index", post_data: posts });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

connectToDatabase().catch(console.dir);
