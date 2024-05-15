const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas } = require('canvas');
const { users, posts } = require('./sampleData');  // Load sample data

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'MicroBlog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

app.get('/post/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = posts.find(post => post.id === postId);

    if (!post) {
        return res.redirect('/error');
    }

    const user = getCurrentUser(req) || {};
    const postUser = findUserByUsername(post.username);

    res.render('postDetail', { post: { ...post, user: postUser }, user });
});

app.post('/posts', isAuthenticated, (req, res) => {
    const { title, content } = req.body;
    const user = getCurrentUser(req);
    addPost(title, content, user);
    res.redirect('/');
});

app.post('/like/:id', isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = posts.find(post => post.id === postId);
    if (post && post.username !== getCurrentUser(req).username) {
        post.likes += 1;
        return res.json({ success: true, likes: post.likes });
    }
    res.json({ success: false });
});


app.get('/profile', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const userPosts = posts.filter(post => post.username === user.username);
    res.render('profile', { user, posts: userPosts });
});

app.get('/avatar/:username', (req, res) => {
    const { username } = req.params;
    const avatar = generateAvatar(username[0]);
    res.set('Content-Type', 'image/png');
    res.send(avatar);
});

app.post('/register', (req, res) => {
    const { username } = req.body;
    if (findUserByUsername(username)) {
        return res.redirect('/register?error=Username%20already%20exists');
    }
    addUser(username);
    res.redirect('/login');
});

app.post('/login', (req, res) => {
    const { username } = req.body;
    const user = findUserByUsername(username);
    if (!user) {
        return res.redirect('/login?error=Invalid%20username');
    }
    req.session.userId = user.id;
    req.session.loggedIn = true;
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/error');
        }
        res.redirect('/');
    });
});

// Function to delete a post
app.post('/delete/:id', isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const postIndex = posts.findIndex(post => post.id === postId && post.username === getCurrentUser(req).username);
    if (postIndex !== -1) {
        const deletedPostTitle = posts[postIndex].title;
        posts.splice(postIndex, 1);
    }
    res.redirect('/profile');
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Load sample data
// Note: Initial sample data loaded from 'sampleData.js'
// let { posts, users } = require('./sampleData');

// Function to find a user by username
function findUserByUsername(username) {
    return users.find(user => user.username === username);
}

// Function to find a user by user ID
function findUserById(userId) {
    return users.find(user => user.id === userId);
}

// Function to add a new user
function addUser(username) {
    const newUser = {
        id: users.length + 1,
        username,
        avatar_url: undefined,
        memberSince: new Date().toISOString(),
    };
    users.push(newUser);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to get the current user from session
function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    const newPost = {
        id: posts.length + 1,
        title,
        content,
        username: user.username,
        timestamp: new Date().toISOString(),
        likes: 0,
    };
    posts.push(newPost);
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#007bff';
    ctx.fillRect(0, 0, width, height);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);
    return canvas.toBuffer();
}
