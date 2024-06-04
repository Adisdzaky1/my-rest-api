const express = require('express');
const cors = require('cors');
const flash = require('connect-flash');
const rateLimit = require("express-rate-limit");
const passport = require('passport');
const expressLayout = require('express-ejs-layouts');
const compression = require('compression');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MemoryStore = require('memorystore')(session);
const secure = require('ssl-express-www');
const schedule = require('node-schedule');
const path = require('path');

require("./settings");

const PORT = process.env.PORT || 8080 || 5000 || 3000;
const app = express();
const { color } = require('./lib/color.js');
const { isAuthenticated } = require('./lib/auth');
const { connectMongoDb } = require('./MongoDB/mongodb');
const { resetAllLimit, getApikey } = require('./MongoDB/function');

const apirouter = require('./routes/api');
const userrouter = require('./routes/users');

connectMongoDb();

app.set('trust proxy', 1);
app.use(compression());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2000,
  message: 'Oops too many requests'
});
app.use(limiter);

app.set('view engine', 'ejs');
app.use(expressLayout);
app.use(express.static(path.join(__dirname, "assets")));

app.set('views', path.join(__dirname, 'views')); // Set the views directory
app.enable('trust proxy');
app.set("json spaces", 2);
app.use(cors());
app.use(secure);

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 86400000 },
  store: new MemoryStore({
    checkPeriod: 86400000
  }),
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(passport.initialize());
app.use(passport.session());
require('./lib/config')(passport);

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

app.get('/', (req, res) => {
  res.render('home', {
    layout: 'home'
  });
});

app.get('/docs', isAuthenticated, async (req, res) => {
  let getkey = await getApikey(req.user.id);
  let { apikey, username, limit } = getkey;
  res.render('index', {
    apikey,
    username,
    limit,
    layout: 'index'
  });
});

// (Repeat similar pattern for other routes)

app.use('/api', apirouter);
app.use('/users', userrouter);

app.use((req, res, next) => {
  res.status(404).json({
    status: false,
    message: "Page not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(color("Server running on port " + PORT, 'green'));
  schedule.scheduleJob('* * * * *', () => {
    resetAllLimit();
  });
});

module.exports = app;
