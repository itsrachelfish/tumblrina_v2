/**
 * Created by Daniel on 10/23/2014.
 */

var tumblr = {
    name: 'Tumblr',
    client: null,
    core: null,
    commands: ['tu'],

    tu: function(from, to, message) {
        tumblr.client.say(to, 'heheheh');
    },

    onMessage: function(from, to, text, rawMessage) {
        tumblr.core.log('DEBUG', tumblr.name + ' - ' + from + ' -> ' + to + ': ' + text);
        var parsed = tumblr.core.parseCommand(text);
        tumblr.core.log('DEBUG', 'Command ' + parsed.command + ' -> ' + parsed.message);
        if(tumblr.commands.indexOf(parsed.command) > -1) {
            tumblr[parsed.command](from, to, parsed.message);
        }
    },

    load: function() {
        if(tumblr.core === null) {
            console.log('[ERROR] ' + tumblr.name + ' module cannot load CORE');
            return;
        }
        if(tumblr.client === null) {
            console.log('[ERROR] ' + tumblr.name + ' module cannot load CLIENT');
            return;
        }

        tumblr.core.log('INFO', 'Loaded ' + tumblr.name + ' module');
        tumblr.client.on('message', tumblr.onMessage);
    },

    unload: function() {
        tumblr.core.log('INFO', 'Unloaded ' + tumblr.name + ' module');
        tumblr.client.removeListener('message', tumblr.onMessage);
    }
}

module.exports = {
    load: function(client, core) {
        tumblr.core = core;
        tumblr.client = client;
        tumblr.load();
    },

    unload: function() {
        tumblr.unload();
        delete tumblr;
    }
}