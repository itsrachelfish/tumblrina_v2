/**
 * Created by Daniel on 10/23/2014.
 */

var imgur = {
    name: 'Imgur',
    client: null,
    core: null,
    config: null,
    commands: ['img'],
    image_ids: [],
    timeouts: [],

    img: function(from, to, message, opts) {
        var timedOut = imgur.timeouts.filter(function(timeout) {return timeout.user == from;})
        if(timedOut.length == 0 && !opts.retry) {
            imgur.timeouts.push({
                user: from,
                started: imgur.core.currentTime(),
                searchedFor: opts.query
            });
            setTimeout(function() {
                imgur.timeouts = imgur.timeouts.filter(function(timeout) { return timeout.user != from; });
            }, imgur.config.timeout * 1000);

            if(opts.random) {
                imgur.findRandom(to, from);
                return;
            }

            imgur.db.getTagged(message, opts, function(row) {
                if(row == undefined) {
                    var url = '';
                    if(opts.reddit) {
                        url = 'https://api.imgur.com/3/gallery/r/' + opts.query + '/';
                    } else {
                        url = 'https://api.imgur.com/3/gallery/search/';
                    }
                    var options = {
                        url: url + '?q=' + message + '&page=' + opts.page,
                        headers: {
                            'Authorization': 'Client-ID ' + imgur.config.ClientID
                        }
                    };
                    imgur.core.request(options, function(error, response, body) {
                        var images = JSON.parse(body).data;
                        if(images.length > 0) {
                            var validItem = false;
                            images.forEach(function(item) {
                                if(imgur.image_ids.indexOf(item.id) != -1) return;
                                if(item.is_album) {
                                    imgur.getAlbumImages(item.id, from, message);
                                    return;
                                }
                                imgur.image_ids.push(item.id);
                                item.created_by = from;
                                item.tag = message;
                                imgur.db.insertImage(item);
                                validItem = true;
                            });
                            if(validItem) {
                                imgur.img(from, to, message, opts);
                            } else {
                                if(++opts.page < 10) {
                                    opts.rety = true;
                                    imgur.img(from, to, message, opts);
                                    return;
                                }
                                imgur.client.notice(from, '[IMGUR] There are results to view, but you\'ve gone through every single one on Imgur already!');
                            }
                        } else {
                            imgur.client.notice(from, '[IMGUR] Sorry, couldn\'t find anything related to your search.');
                        }
                    });
                } else {
                    var say = '[IMGUR] ';
                    if(row.nsfw == 0) {
                        if(row.name != undefined && row.name != '') {
                            say += row.name + ' @ ';
                        } else {
                            say += 'Untitled @ ';
                        }
                        say += ' ' + row.url;
                    } else {
                        say += '!!! POTENTIAL NSFW !!! ' + row.url + ' !!! POTENTIAL NSFW !!!';
                    }
                    imgur.client.say(to, say);
                }
            });
        } else {
            timedOut = timedOut[0];
            imgur.client.notice(timedOut.user, '[IMGUR] Sorry, you\'re still timed out for another ' +
                (imgur.config.timeout * 1000 - (imgur.core.currentTime() - timedOut.started))/1000 +
                ' seconds from when you searched for ' + timedOut.searchedFor);
        }
    },
    randomString: function (length) {
        var result = '';
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
        for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
        return result;
    },
    findRandom: function(to, from) {
        var id = imgur.randomString(5);
        var url = 'http://i.imgur.com/'+id+'.png'
        imgur.core.request(url, function(error, response, body) {
            if(body.length < 50000 || response.statusCode == 404) {
                imgur.findRandom(to, from);
                return;
            }
            imgur.db.insertImage({
                tag: '[RANDOM]',
                created_by: from,
                name: '[RANDOM]',
                id: id,
                link: url,
                nsfw: 0
            });
            imgur.client.say(to, '[IMGUR] ' + from + ' Random Link (NSFW???): ' + url);
        });
    },
    getAlbumImages: function(album_id, searched_by, tag) {
        var options = {
            url: 'https://api.imgur.com/3/album/' + album_id,
            headers: {
                'Authorization': 'Client-ID ' + imgur.config.ClientID
            }
        };
        imgur.core.request(options, function(error, response, body) {
            var album = JSON.parse(body).data;
            album.images.forEach(function(item) {
                if(imgur.image_ids.indexOf(item.id) != -1) return;
                if(item.is_album) {
                    imgur.getAlbumImages(item.id, searched_by, tag);
                    return;
                }
                imgur.image_ids.push(item.id);
                item.created_by = searched_by;
                item.tag = tag;
                imgur.db.insertImage(item);
            });
        });
    },
    parseParams: function(message) {
        var params = {
            reddit: 0,
            page: 0,
            random: false,
            retry: false
        };
        message.split(' ').forEach(function(param) {
            if(param[0] != '-') {
                return;
            }
            if(param == '-reddit') {
                params.reddit = true;
            }
            if(param == '-random') {
                params.random = true;
            }
            message = message.replace(param, '');
        });
        params.query = message.trim();
        return params;
    },
    db: {
        connection: null,
        getTagged: function(tag, options, callback) {
            var query = 'select id, name, url, nsfw, (select count(id) from images where tag = $tag) as total_tagged,' +
                '(select count(id) from images where tag = $tag and sent = 1) as total_sent ' +
                'from images where not sent and tag = $tag ';
            if(query.nsfw) {
                query += 'and nsfw = 1 ';
            }
            imgur.db.connection.get(query + ' limit 1', {
                $tag: tag
            }, function(err, row) {
                if(err) {
                    console.error(err);
                }
                if(row != undefined) {
                    imgur.db.markSent(row.id);
                }
                callback(row);
            });
        },
        markSent: function(id) {
            var prep = imgur.db.connection.prepare('update images set sent = 1 where id = $id');
            prep.run({
                $id: id
            });
            prep.finalize();
        },
        insertImage: function(image) {
            var prep = imgur.db.connection.prepare('insert or ignore into images(tag, searched_by, name, image_id, url, nsfw) values(' +
                '$tag, $searched_by, $name, $image_id, $url, $nsfw)');
            prep.run({
                $tag: image.tag,
                $searched_by: image.created_by,
                $name: image.title,
                $image_id: image.id,
                $url: image.link,
                $nsfw: (image.nsfw == null ? false : true)
            });
            prep.finalize();
        },
        getIDList: function() {
            imgur.db.connection.all('select image_id from images', function(err, rows) {
                if(err) return;
                rows.forEach(function(row) {
                    imgur.image_ids.push(row.image_id);
                });
            });
        },
        createSchema: function() {
            imgur.db.connection.run('create table if not exists images(' +
                'id integer primary key autoincrement not null,' +
                'tag text,' +
                'searched_by text,' +
                'name text,' +
                'image_id text,' +
                'sent boolean default false,' +
                'url text,' +
                'nsfw boolean, ' +
                'created timestamp default current_timestamp,' +
                'unique(image_id));' +
                'create index if not exists on images(tag);');
        },
        start: function() {
            imgur.db.connection = new imgur.core.sqlite.Database('./databases/imgur.sqlite3');
            imgur.db.createSchema();
            imgur.db.getIDList();
        },
        stop: function() {
            imgur.db.connection.close();
        }
    },

    onMessage: function(from, to, text, rawMessage) {
        var parsed = imgur.core.parseCommand(text);
        if(imgur.commands.indexOf(parsed.command) > -1) {
            var params = imgur.parseParams(parsed.message);
            imgur[parsed.command](from, to, params.query, params);
        }
    },

    load: function() {
        if(imgur.core === null) {
            console.log('[ERROR] ' + imgur.name + ' module cannot load CORE');
            return;
        }
        if(imgur.client === null) {
            console.log('[ERROR] ' + imgur.name + ' module cannot load CLIENT');
            return;
        }
        imgur.config = imgur.core.loadConfig('imgur');
        imgur.core.log({level: 'INFO', text: 'Loaded ' + imgur.name + ' module'});
        imgur.client.on('message', imgur.onMessage);
        imgur.db.start();
    },

    unload: function() {
        imgur.core.log({level: 'INFO', text: 'Unloaded ' + imgur.name + ' module'});
        imgur.client.removeListener('message', imgur.onMessage);
        imgur.db.stop();
    }
}

module.exports = {
    load: function(client, core) {
        imgur.core = core;
        imgur.client = client;
        imgur.request = core.request;
        imgur.load();
    },

    unload: function() {
        imgur.unload();
        delete imgur;
    }
}