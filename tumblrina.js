/**
 * Created by Daniel on 10/23/2014.
 */

var fs = require('fs');
var irc = require('irc');
var config = require('./config/config.js');
var core = require('./core.js');
var client = new irc.Client(config.irc.server, config.irc.userName, config.irc);
var sqlite3 = require('sqlite3').verbose();
var request = require('request');
var async = require('async');
var htmlStrip = require('htmlstrip-native');
var shittyTumblr = require('tumblr.js');

client.addListener('error', function(message) {
    console.log('error: ', message);
});

if(config.irc.antiGhost) {
    core.log({level: 'INFO', text: 'Anti-ghosting enabled!'});
    client.once('registered', function(message) {
        client.send('PRIVMSG', 'NickServ identify ' + config.irc.userName + ' ' + config.irc.antiGhostPassword);
        client.send('PRIVMSG', 'NickServ ghost ' + config.irc.userName);
        client.send('NICK', config.irc.userName);
    });
}

core.client = client;
core.config = config;
core.sqlite = sqlite3;
core.request = request;
core.async = async;
core.htmlStrip = htmlStrip;
core.shittyTumblr = shittyTumblr;

core.log({level:'INFO', text: 'Starting ' + config.irc.userName});
core.log({level: 'INFO', text: '------------------------------------'});
core.log({level: 'INFO', text: 'Loading modules...'});
fs.readdir('./modules', function(err, files) {
    files.forEach(function(file) {
        core.loadModule(file);
    });
});

