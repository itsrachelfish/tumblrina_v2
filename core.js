/**
 * Created by Daniel on 10/23/2014.
 */

var core = {
    client: null,
    modules: [],
    configs: [],

    loadConfig: function(name) {
        var filePath = './config/' + name + '.json';
        delete core.configs[name];
        delete require.cache[require.resolve(filePath)];
        core.configs[name] = require(filePath);
        return core.configs[name];
    },
    log: function(message) {
        console.log('[' + core.currentTime() + '][' + message.level + '] ' + message.text);
    },
    loadModule: function(module) {
        var filePath = './modules/' + module;
        if(filePath.substring(filePath.length-3, filePath.length) != '.js') {
            filePath += '.js';
        }
        core.log({level: 'INFO', text: 'Loaded module \'' + module + '\''});
        core.modules[module] = require(filePath);
        core.modules[module].load(core.client, core);
    },
    unloadModule: function(module) {
        var filePath = './modules/' + module;
        if(filePath.substring(filePath.length-3, filePath.length) != '.js') {
            filePath += '.js';
        }
        core.log({level: 'INFO', text: 'Unloading module \'' + module + '\''});
        core.modules[module].unload();

        delete core.modules[module];
        delete require.cache[require.resolve(filePath)];
    },
    parseCommand: function(rawCommand) {
        var command = rawCommand.split(' ').splice(0, 1).join(' ');
        var message = rawCommand.substring(command.length, rawCommand.length).trim();
        if(command[0] == '`') {
            return {command: command.substring(1, command.length), message: message};
        } else {
            return {command: '', message: ''};
        }
    },
    reloadModule: function(module) {
        core.unloadModule(module);
        core.loadModule(module);
    },
    currentTime: function() {
        return Date.now();
    }
};

module.exports = core;