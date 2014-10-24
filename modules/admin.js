/**
 * Created by Daniel on 10/23/2014.
 */

var admin = {
    name: 'Administration',
    client: null,
    core: null,
    commands: ['say', 'leave', 'join', 'reload', 'quit',
        'adminlist', 'adminadd', 'adminremove',
        'loadmod', 'unloadmod'],
    admins: ['dbladez'],

    say: function(from, to, message) {
        admin.client.say(to, message);
    },
    leave: function(from, to, message) {
        admin.client.part(message);
    },
    join: function(from, to, message) {
        admin.client.join(message);
    },
    quit: function(from, to, message) {
        admin.client.disconnect();
    },
    reload: function(from, to, message) {
        admin.core.reloadModule(message + '.js');
    },
    adminadd: function(from, to, message) {
        admin.admins.push(message);
    },
    adminremove: function(from, to, message) {
        var index = admin.admins.indexOf(message);
        if(index > -1) {
            admin.admins.splice(index, 1);
        }
    },
    loadmod: function(from, to, message) {
        admin.core.loadModule(message + '.js');
    },
    unloadmod: function(from, to, message) {
        admin.core.unloadModule(message + '.js');
    },
    adminlist: function(from, to, message) {
        var adminList = '';
        admin.admins.sort().forEach(function(admin) {
            adminList += admin + ', ';
        });
        adminList = adminList.substring(0, adminList.length - 2);
        admin.client.say(from, 'Administrator listing: ' + adminList);
    },
    onMessage: function(from, to, text, rawMessage) {
        if(admin.admins.indexOf(from) == -1) {
            return;
        }
        admin.core.log('DEBUG', admin.name + ' - ' + from + ' -> ' + to + ': ' + text);
        var parsed = admin.core.parseCommand(text);
        admin.core.log('DEBUG', 'Command ' + parsed.command + ' -> ' + parsed.message);
        if(admin.commands.indexOf(parsed.command) > -1) {
            admin[parsed.command](from, to, parsed.message);
        }
    },
    load: function() {
        if(admin.core === null) {
            console.log('[ERROR] Admin module cannot load CORE');
            return;
        }
        if(admin.client === null) {
            console.log('[ERROR] Admin module cannot load CLIENT');
            return;
        }

        admin.core.log('INFO', 'Loaded ' + admin.name + ' module');
        admin.client.on('message', admin.onMessage);
    },
    unload: function() {
        admin.core.log('INFO', 'Unloaded ' + admin.name + ' module');
        admin.client.removeListener('message', admin.onMessage);
    }
}

module.exports = {
    load: function(client, core) {
        admin.core = core;
        admin.client = client;
        admin.load();
    },

    unload: function() {
        admin.unload();
        delete admin;
    }
}