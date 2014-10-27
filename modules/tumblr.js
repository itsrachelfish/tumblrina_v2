/**
 * Created by Daniel on 10/23/2014.
 */

var tumblr = {
    name: 'Tumblr',
    client: null,
    core: null,
    config: null,
    commands: ['tu'],
    timeouts: [],
    postList: [],
    submissionsList: [],
    lastBlog: '',

    tu: function(from, to, message) {
        var params = tumblr.parseParams(message);
        params.from = from;
        params.to = to;
        if(params.ban && params.query != '') {
            tumblr.db.banBlog(params.query, params.from);
            return;
        }
        if(params.unban && params.query != '') {
            tumblr.db.unbanBlog(params.query, params.from);
            return;
        }
        var queryString = 'http://api.tumblr.com/v2/mobile/search?reblog_info=true&api_key=' + tumblr.config.apiKey;
        if(tumblr.config.secretSauce != '' && params.nsfw) {
            queryString += tumblr.config.secretSauce;
        }

        var timedOut = tumblr.timeouts.filter(function(timeout) {return timeout.user == from;})
        if(timedOut.length == 0) {
            tumblr.timeouts.push({
                user: from,
                started: tumblr.core.currentTime(),
                searchedFor: params.query
            });

            setTimeout(function() {
                tumblr.timeouts = tumblr.timeouts.filter(function(timeout) { return timeout.user != from; });
            }, tumblr.config.timeout * 1000);

            tumblr.search(queryString, params, tumblr.reblog)
        } else {
            timedOut = timedOut[0];
            tumblr.client.notice(timedOut.user, 'Sorry, you\'re still timed out for another ' +
                (tumblr.config.timeout * 1000 - (tumblr.core.currentTime() - timedOut.started))/1000 +
                ' seconds from when you searched for ' + timedOut.searchedFor);
        }
    },

    reblog: function(reblogObject) {
        var shittyClient = tumblr.core.shittyTumblr.createClient({
            consumer_key: tumblr.config.consumerKey,
            consumer_secret: tumblr.config.consumerSecret,
            token: tumblr.config.token,
            token_secret: tumblr.config.tokenSecret
        });

        shittyClient.reblog('tootbot.tumblr.com', { id: reblogObject.postID, reblog_key: reblogObject.reblogKey, comment: 'Please talk to me http://tootbot.tumblr.com/ask I really want to make some friends...' }, function (err, data) {
            console.log(err);
            console.log(data);
        });
    },

    search: function(url, params, cb) {
        var reblogObject = {
            reblogKey: '',
            postID: '',
            format: ''
        };

        if(params.query == undefined || params.query == '') {
            return;
        }
        if(params.firstAttempt == true) {
            if(params.top) {
                url += '&mode=top';
            } else if(params.recent) {
                url += '&mode=recent';
            }
            url += '&query=' + params.query.replace(' ', '%20');
        }

        tumblr.request(url + (params.firstAttempt == false ? '&offset=' + params.offset : ''), function(err, response, body) {
            params.firstAttempt = false;
            if(!err && response.statusCode == 200) {
                var posts = JSON.parse(body).response.posts;
                var foundPost = false;
                tumblr.core.async.waterfall([
                    function(callback) {
                        tumblr.db.connection.all('select name from banned_blogs where is_banned', function(err, rows) {
                            if(err) {
                                console.error(err);
                                callback('error in db call');
                                return;
                            }
                            var blogs = [];
                            rows.forEach(function(row) {
                               blogs.push(row.name);
                            });
                            callback(null, blogs);
                        })
                    },
                    function(blogs, callback) {
                        posts.forEach(function(post) {
                            params.offset = post.timestamp;
                            if(blogs.indexOf(post.blog_name) > -1 ||
                                tumblr.postList.indexOf(post.id) > -1 ||
                                tumblr.lastBlog == post.blog_name) return;

                            if(!foundPost) {
                                if(params.image && post.type != 'photo') return;
                                if(params.video && post.type != 'video') return;
                                if(params.text && post.type != 'text') return;
                                if(params.audio && post.type != 'audio') return;

                                var sayString = '';
                                tumblr.lastBlog = post.blog_name;

                                if(params.nsfw) {
                                    sayString = '!!! [NSFW] ' + post.short_url + ' [NSFW] !!!';
                                } else {
                                    sayString = '[' + post.type.toUpperCase() + '] ';
                                    if(post.body != undefined && post.body != '') {
                                        sayString += post.body;
                                    } else if(post.caption != undefined && post.caption != '') {
                                        sayString += post.caption;
                                    } else if(post.photos != undefined) {
                                        var captionAdded = false;
                                        post.photos.forEach(function(photo) {
                                            if(captionAdded) return;
                                            sayString += photo.caption;
                                            captionAdded = true;
                                        });
                                    } else {
                                        sayString += post.blog_name + ' is retarded and doesn\'t know how to caption literally anything in this post.';
                                    }
                                    sayString = tumblr.core.htmlStrip.html_strip((sayString.substring(0, 400-(post.short_url.length)-13) + ' @ ' + post.short_url)).replace(/(\r\n|\n|\r)/gm, ' ');
                                }
                                post.params = params;
                                tumblr.client.say(params.to, sayString);
                                tumblr.postList.push(post.id);
                                tumblr.db.savePost(post);

                                reblogObject.postID = post.id;
                                reblogObject.reblogKey = post.reblog_key;
                                reblogObject.format = post.format;
                                foundPost = true;
                                callback(null, 'Sent message');
                                cb(reblogObject);
                            }
                        });
                        if(!foundPost) {
                            callback('no-results');
                        }
                    }
                ], function(err, result) {
                    if(err) {
                        if(err == 'no-results') {
                            var checkes = 10;
                            if(params.text) {
                                checks = 50;
                            }
                            if(++params.attempts == checks) {
                                tumblr.client.notice(params.from, 'Sorry, I couldn\'t find any results for ' + params.query + ' in ' + checks*20 + ' results.');
                                console.error('Couldn\'t find result for url: ' + url + ' Params were: ' + JSON.stringify(params));
                                tumblr.client.say('dbladez', 'Couldn\'t find result for url: ' + url);
                                tumblr.client.say('dbladez', JSON.stringify(params));
                                return;
                            }
                            setTimeout(function() {
                                tumblr.search(url, params, cb);
                            }, 1000);
                        }
                    }
                });
            } else {
                tumblr.core.log({level: 'ERROR', text: err});
                tumblr.client.say('dbladez', 'Error when ' + params.from + ' searched. Params were: ' + JSON.stringify(params));
                tumblr.client.say('dbladez', response.message);
            }
        });
    },

    parseParams: function(message) {
        var params = {
            image: false,
            video: false,
            text: true,
            audio: false,
            allowDuplicates: false,
            top: false,
            recent: true,
            nsfw: false,
            ban: false,
            unban: false,
            query: '',
            firstAttempt: true,
            offset: 0,
            attempts: 0
        };

        message.split(' ').forEach(function(param) {
            if(param[0] != '-') {
                return;
            }
            if(param == '-img') {
                params.image = true;
                params.text = false;
            }
            if(param == '-vid') {
                params.video = true;
                params.text = false;
            }
            if(param == '-nsfw') {
                params.nsfw = true;
            }
            if(param == '-dups') {
                params.allowDuplicates = true;
            }
            if(param == '-top') {
                params.recent = false;
                params.top = true;
            }
            if(param == '-ban') {
                params.ban = true;
            }
            if(param == '-unban') {
                params.unban = true;
            }
            if(param == '-audio') {
                params.audio = true;
                params.text = false;
            }
            message = message.replace(param, '');
        });
        params.query = message.trim();
        return params;
    },

    db: {
        connection: null,
        createSchema: function() {
            tumblr.db.connection.run('create table if not exists posts(' +
                'id integer primary key autoincrement not null, ' +
                'post_id integer, ' +
                'blog_name text, ' +
                'reblog_key text, ' +
                'post_url text, ' +
                'searched_by text, ' +
                'query text, ' +
                'search_time datetime default current_timestamp);');
            tumblr.db.connection.run('create table if not exists post_tags(' +
                'id integer primary key autoincrement not null,' +
                'tag text,' +
                'unique(tag));');
            tumblr.db.connection.run('create table if not exists post_tag_relationships(' +
                'id integer primary key autoincrement not null,' +
                'post_id integer,' +
                'tag_id integer,' +
                'foreign key(post_id) references posts(id),' +
                'foreign key(tag_id) references post_tags(id));');
            tumblr.db.connection.run('create table if not exists banned_blogs(' +
                'id integer primary key autoincrement not null,' +
                'name text,' +
                'banned_by text,' +
                'banned_time datetime default current_timestamp,' +
                'unbanned_by text, ' +
                'unbanned_time datetime, ' +
                'updated_timestamp datetime default current_timestamp, ' +
                'is_banned boolean default 1);');
            tumblr.db.connection.run('create table if not exists submissions(' +
                'id integer primary key autoincrement not null,' +
                'post_id integer,' +
                'asked_by text,' +
                'asked_by_url text,' +
                'question text,' +
                'timestamp datetime);');
        },
        getSubmissionOffset: function() {
            tumblr.db.connection.all('select post_id from submissions', function(err, rows) {
                if(err) {
                    console.error(err);
                    return;
                }
                rows.forEach(function(row) {
                    tumblr.submissionsList.push(row.post_id);
                });
            });
        },
        saveSubmission: function(submission) {
            tumblr.submissionsList.push(submission.id);
            var prep = tumblr.db.connection.prepare('insert into submissions(post_id, asked_by, asked_by_url, question, timestamp) ' +
                'VALUES($post_id, $asked_by, $asked_by_url, $question, $timestamp);')
            prep.run({
                $post_id: submission.id,
                $asked_by: submission.asking_name,
                $asked_by_url: submission.asking_url,
                $question: submission.question,
                $timestamp: submission.timestamp
            });
            prep.finalize();
        },
        savePost: function(post) {
            var postID = 0;
            var prep = null;

            tumblr.core.async.series([
                function(callback) {
                    prep = tumblr.db.connection.prepare('insert into posts(post_id, blog_name, reblog_key, post_url, searched_by, query) ' +
                        'VALUES($post_id, $blog_name, $reblog_key, $post_url, $searched_by, $query);')
                    prep.run({
                        $post_id: post.id,
                        $blog_name: post.blog_name,
                        $reblog_key: post.reblog_key,
                        $post_url: post.post_url,
                        $searched_by: post.params.from,
                        $query: post.params.query
                    }, function(err) {
                        if(!err) {
                            postID = prep.lastID;
                        }
                        callback(null);
                    });
                    prep.finalize();
                },
                function(callback) {
                    if(post.tags != undefined) {
                        prep = tumblr.db.connection.prepare('insert or ignore into post_tags(tag) values($tag)');
                        post.tags.forEach(function(tag) {
                            prep.run({
                                $tag: tag
                            });
                        });
                        prep.finalize();

                        prep = tumblr.db.connection.prepare('insert into post_tag_relationships(post_id, tag_id) values($post_id, (select id from post_tags where tag = $tag));');
                        post.tags.forEach(function(tag) {
                            prep.run({
                                $post_id: postID,
                                $tag: tag
                            });
                        });
                        prep.finalize();
                        callback(null);
                    }
                }
            ]);
        },
        loadPosts: function() {
            tumblr.db.connection.each('select post_id from posts', function(err, row) {
                if(err) return;
                tumblr.postList.push(row.post_id);
            });
        },
        start: function() {
            tumblr.db.connection = new tumblr.core.sqlite.Database('./databases/tumblr.sqlite3');
            tumblr.db.createSchema();
            tumblr.db.loadPosts();
            tumblr.db.getSubmissionOffset();
        },
        stop: function() {
            tumblr.db.connection.close();
        },
        banBlog: function(blogName, bannedBy) {
            var prep = tumblr.db.connection.prepare('insert into banned_blogs(name, banned_by) values($name, $banned_by);');
            prep.run({
                $name: blogName,
                $banned_by: bannedBy
            });
            prep.finalize();
            tumblr.client.say(bannedBy, 'I\'ve banned the tumblr ' + blogName + ' from appearing in search results.');
        },
        unbanBlog: function(blogName, unbannedBy) {
            var prep = tumblr.db.connection.prepare('update banned_blogs set unbanned_by = $unbanned_by, unbanned_time = current_timestamp, is_banned = 0 where name = $blog_name and is_banned = 1');
            prep.run({
                $unbanned_by: unbannedBy,
                $blog_name: blogName
            });
            prep.finalize();
            tumblr.client.say(unbannedBy, 'I\'ve removed the ban on ' + blogName + ' from appearing in search results.');
        },
        getBannedBlogs: function() {
            // :(
        }
    },

    onMessage: function(from, to, text, rawMessage) {
        tumblr.core.log({level: 'DEBUG', text: tumblr.name + ' - ' + from + ' -> ' + to + ': ' + text});
        var parsed = tumblr.core.parseCommand(text);
        tumblr.core.log({level: 'DEBUG', text: 'Command ' + parsed.command + ' -> ' + parsed.message});
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

        tumblr.core.log({level: 'INFO', text: 'Loaded ' + tumblr.name + ' module'});
        tumblr.client.on('message', tumblr.onMessage);
        tumblr.db.start();
        setTimeout(tumblr.listeners.start, 30000);
    },

    unload: function() {
        tumblr.core.log({level: 'INFO', text: 'Unloaded ' + tumblr.name + ' module'});
        tumblr.client.removeListener('message', tumblr.onMessage);
        tumblr.db.stop();
        tumblr.listeners.stop();
    },

    listeners: {
        submission: {
            interval: null,
            listener: function() {
                var shittyClient = tumblr.core.shittyTumblr.createClient({
                    consumer_key: tumblr.config.consumerKey,
                    consumer_secret: tumblr.config.consumerSecret,
                    token: tumblr.config.token,
                    token_secret: tumblr.config.tokenSecret
                });

                shittyClient.submissions('tootbot.tumblr.com',
                    function(err, data) {
                        if(err) {
                            console.error(err);
                            return;
                        }
                        data.posts.forEach(function(submission) {
                            if(tumblr.submissionsList.indexOf(submission.id) == -1) {
                                tumblr.db.saveSubmission(submission);
                                tumblr.config.ircChannels.forEach(function(channel) {
                                    var message = '[New Tumblr Message] ' + submission.asking_name;
                                    if(submission.asking_name != 'Anonymous') {
                                        message += ' (http://' + submission.asking_name + '.tumblr.com)';
                                    }
                                    message += ' writes: ' + submission.question;
                                    if(message.length > 400) {
                                        message = message.substring(0, 400);
                                    }
                                    tumblr.client.say(channel, message);
                                });
                            }
                        });
                    }
                );
            }
        },
        start: function() {
            tumblr.core.log({level: 'INFO', text:'Starting tumblr listeners'});
            tumblr.listeners.submission.interval = setInterval(tumblr.listeners.submission.listener, 30000);
        },
        stop: function() {
            tumblr.core.log({level: 'INFO', text:'Stopping tumblr listeners'});
            clearInterval(tumblr.listeners.submission.interval);
        }
    }
}

module.exports = {
    load: function(client, core) {
        tumblr.core = core;
        tumblr.client = client;
        tumblr.config = core.config.tumblr;
        tumblr.request = core.request;
        tumblr.load();
    },

    unload: function() {
        tumblr.unload();
        delete tumblr;
    }
}