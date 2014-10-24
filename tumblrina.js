/**
 * Created by Daniel on 10/23/2014.
 */

var fs = require('fs');
var irc = require('irc');
var config = require('./config/config.js');
var core = require('./core.js');
var client = new irc.Client(config.connection.server, config.connection.userName, config.connection);

client.addListener('error', function(message) {
    console.log('error: ', message);
});

if(config.connection.antiGhost) {
    core.log('INFO', 'Anti-ghosting enabled!');
    client.once('registered', function(message) {
        client.send('PRIVMSG', 'NickServ identify ' + config.connection.userName + ' ' + config.connection.antiGhostPassword);
        client.send('PRIVMSG', 'NickServ ghost ' + config.connection.userName);
        client.send('NICK', config.connection.userName);
    });
}

core.client = client;
core.log('INFO', 'Starting ' + config.connection.userName);
core.log('INFO', '------------------------------------');
core.log('INFO', 'Loading modules...');
fs.readdir('./modules', function(err, files) {
    files.forEach(function(file) {
        core.loadModule(file);
    });
});

