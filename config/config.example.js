/**
 * Created by Daniel on 10/24/2014.
 */

module.exports = {
    irc: {
        server: 'irc.freenode.net',
        userName: 'tumblrina_v2',
        port: 6667,
        debug: true,
        showErrors: true,
        autoRejoin: true,
        autoConnect: true,
        channels: ['##dbuttz2'],
        secure: false,
        selfSigned: true,
        certExpired: true,
        floodProtection: false,
        floodProtectionDelay: 1000,
        antiGhost: false,
        antiGhostPassword: ''
    },
    tumblr: {
        ircChannels: ['##dbuttz2'],
        apiKey: '',
        secretSauce: ''
    }
}