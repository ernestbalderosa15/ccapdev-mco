//Install Command:
//npm init -y
//npm i express express-handlebars body-parser mongoose

const express = require('express');
const server = express();

const bodyParser = require('body-parser')
server.use(express.json()); 
server.use(express.urlencoded({ extended: true }));

const handlebars = require('express-handlebars');
server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
    //defaultLayout: 'index',//added check later
    extname: 'hbs'
}));

server.use(express.static('public'));

const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/forum');

const postSchema = new mongoose.Schema({
    authorImg: { type: String },
    author: { type: String },
    postDate: { type: Date },
    postTitle: { type: String },
    postImg: { type: String },
    postTags: { type: Array },
    postUp: { type: Number },
    postDown: { type: Number },
    postComCnt: { type: Number },//comments
    postSaved: { type: Boolean }
},{ versionKey: false });
  
const postModel = mongoose.model('post', postSchema);

//console.log(post1);

//const userSchema = new mongoose.Schema({
    
//},{ versionKey: false });
  
//const userModel = mongoose.model('post', userSchema);

server.get('/', async function(req, resp){
    let post_data = await postModel.find({}).lean();
    resp.render('main',{
        layout: 'index',
        title: 'The Forum',
        post_data: post_data
    });
});



//Only at the very end should the database be closed.
function finalClose(){
    console.log('Close connection at the end!');
    mongoose.connection.close();
    process.exit();
}

process.on('SIGTERM',finalClose);  //general termination signal
process.on('SIGINT',finalClose);   //catches when ctrl + c is used
process.on('SIGQUIT', finalClose); //catches other termination commands

const port = process.env.PORT | 9090;
server.listen(port, function(){
    console.log('Listening at port '+port);
});
