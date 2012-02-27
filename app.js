
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , socketio = require('socket.io');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// GeoNote handling
var io = socketio.listen(app);
var clients = {};
var notes = [];

io.sockets.on('connection', function (socket) {

  socket.on('new geonote', function (note) {
	// Expect a GeoJSON point
    socket.broadcast.emit('new geonote', note);
    console.log(note);
  });
});
