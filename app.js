const express = require("express");
const mongoose = require("mongoose");
const server = express();

const bodyParser = require("body-parser");
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

const handlebars = require("express-handlebars");
server.set("view engine", "hbs");
server.engine(
  "hbs",
  handlebars.engine({
    extname: "hbs",
  })
);

mongoose.connect(
  "mmongodb+srv://atlas-sample-dataset-load-668a80f4d7654d0a1c1b4e3e:<password>@cluster0.hhgoid5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

server.use(express.static("public"));

let posts = [
  {
    _id: "6689e7888d99ea9e4463fd07",
    authorImg: "https://i.pravatar.cc/150?img=54",
    author: "@RobertKilla",
    postDate: "2018-04-15T16:54:40.000Z",
    postTitle: "Help! Need Tips for Starting a Balcony Garden",
    postImg:
      "https://www.thespruce.com/thmb/gF9yLFJBtskM1A1elZ20ZI8U-bU=/4285x0/filters:no_upscale():max_bytes(150000):strip_icc()/tips-for-starting-a-balcony-garden-847801-hero-f51f8bf03e1949ea95d429c842b6837c.jpg",
    postTags: ["gardening"],
    postUp: 4,
    postDown: 0,
    postComCnt: 0,
    postSaved: true,
    usersUpvoted: ["@RobertKilla"],
  },
  {
    _id: "6689e7888d99ea9e4463fd08",
    authorImg: "https://i.pravatar.cc/150?img=54",
    author: "@JaneDoe",
    postDate: "2018-04-15T16:54:40.000Z",
    postTitle: "Best Programming Practices",
    postImg:
      "https://www.thespruce.com/thmb/gF9yLFJBtskM1A1elZ20ZI8U-bU=/4285x0/filters:no_upscale():max_bytes(150000):strip_icc()/tips-for-starting-a-balcony-garden-847801-hero-f51f8bf03e1949ea95d429c842b6837c.jpg",
    postTags: ["programming"],
    postUp: 4,
    postDown: 0,
    postComCnt: 0,
    postSaved: true,
  },
];

server.get("/", (req, res) => {
  res.render("main", { layout: "index", post_data: posts });
});

server.post("/upvote", (req, res) => {
  const postId = req.body.postId;
  const post = posts.find((p) => p._id === postId);
  if (post) {
    post.postUp += 1;
    res.json({ success: true, postUp: post.postUp });
  } else {
    res.status(404).json({ success: false, message: "Post not found" });
  }
});

const port = process.env.PORT || 9090;
server.listen(port, function () {
  console.log("Listening at port " + port);
});
