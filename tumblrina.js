/**
 * Created by Daniel on 10/23/2014.
 */

var fs = require('fs');
var irc = require('irc');
var core = require('./core.js');
var sqlite3 = require('sqlite3').verbose();
var request = require('request');
var async = require('async');
var htmlStrip = require('htmlstrip-native');
var shittyTumblr = require('tumblr.js');
var config = core.loadConfig('irc');
var client = new irc.Client(config.server, config.userName, config);

client.addListener('error', function(message) {
    console.log('error: ', message);
});

if(config.antiGhost) {
    core.log({level: 'INFO', text: 'Anti-ghosting enabled!'});
    client.once('registered', function(message) {
        client.send('PRIVMSG', 'NickServ identify ' + config.userName + ' ' + config.antiGhostPassword);
        client.send('PRIVMSG', 'NickServ ghost ' + config.userName);
        client.send('NICK', config.userName);
    });
}

core.client = client;
core.config = config;
core.sqlite = sqlite3;
core.request = request;
core.async = async;
core.htmlStrip = htmlStrip;
core.shittyTumblr = shittyTumblr;

core.log({level:'INFO', text: 'Starting ' + config.userName});
core.log({level: 'INFO', text: '------------------------------------'});
core.log({level: 'INFO', text: 'Loading modules...'});
fs.readdir('./modules', function(err, files) {
    files.forEach(function(file) {
        core.loadModule(file);
    });
});

