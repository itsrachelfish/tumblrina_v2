/**
 * Created by Daniel on 10/23/2014.
 */

var core = {
    client: null,
    modules: {},

    log: function(message) {
        core.log('INFO', message);
    },
    log: function(level, message) {
        console.log('[' + new Date().getTime() + '][' + level + '] ' + message);
    },
    loadModule: function(module) {
        var filePath = './modules/' + module;
        if(filePath.substring(filePath.length-3, filePath.length) != '.js') {
            filePath += '.js';
        }
        core.log('INFO', 'Loaded module \'' + module + '\'');
        core.modules[module] = require(filePath);
        core.modules[module].load(core.client, core);
    },
    unloadModule: function(module) {
        var filePath = './modules/' + module;
        if(filePath.substring(filePath.length-3, filePath.length) != '.js') {
            filePath += '.js';
        }
        core.log('DEBUG', 'Unloading module \'' + module + '\'');
        core.modules[module].unload();

        delete core.modules[module];
        delete require.cache[require.resolve(filePath)];
    },
    parseCommand: function(rawCommand) {
        var command = rawCommand.split(' ').splice(0, 1).join(' ');
        var message = rawCommand.substring(command.length, rawCommand.length).trim();
        return {command: command, message: message};
    },
    reloadModule: function(module) {
        core.unloadModule(module);
        core.loadModule(module);
    }
};

module.exports = core;