// -*- coding: utf-8 -*-
// Copyright (C) 2013 Ckluster Technologies
// All Rights Reserved.
//
// This software is subject to the provision stipulated in
// http://www.ckluster.com/OPEN_LICENSE.txt.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

var log = require('./log.js'),
    notifications = require('./notificationpipe.js'),
    path = require('path'),
    express = require('express'),
    cookie = require('cookie'),
    fs = require('fs'),
    ini = require('ini'),
    http = require('http');

 /**
  * Main function for this server script, send to the zeromq server the cookie 
  * of the connected user and start listining for events related to that user,
  * if there's new evets, socket.io emits those events to the client
  *
  **/
function main(configurationFile) {
    /**
    * Create express web app.
    */
    var app = express(),
        /**
        * Server configuration, it require http and load our express web app.
        */
        server = require('http').createServer(app),
        io = require('socket.io').listen(server);

    // zeromq pipe that read notifications
    var pipe = notifications.initNotificationPipe(configurationFile);
    // check if we have a valid pipe connection
    if (pipe === null) {
        log.error('Unable to connect or an error occurred');
        process.exit(1);
    }

    // read the necessary configuration options
    var options = getConfiguration(configurationFile);
    // the session cookie name
    var cookieName = options.cookieName;
    // the "emit" type that will be sent through socket.io
    var messageType = options.notificationType;

    io.sockets.on('connection', function (socket) {
        var cookies = socket.handshake.headers.cookie;
        log.debug('Connection received.');
        if (cookies === undefined || cookies === null) {
            log.debug('No cookies set');
            socket.disconnect();
            return;
        }
        var sessionCookie = cookie.parse(cookies)[cookieName];
        if (sessionCookie === undefined || cookies === null) {
            log.debug('No session with this connection');
            socket.disconnect();
            return;
        }

        // these variables contain connection information about the user
        var socketUser = null,
            userRegistry = null;

        pipe.getUser(sessionCookie, function(user) {
            // disconnect if such user doesn't exist
            if (user === null) {
                log.debug('There is no such session cookie: ' + sessionCookie);
                socket.disconnect();
                return;
            }

            socketUser = user;
            log.debug('Registering user: ' + user);
            userRegistry = pipe.register(user, function(message) {
                log.debug(
                    'Sending notification to user ' + user +
                    ' with type ' + messageType
                );
                log.debug(message);
                // emit message to the user
                socket.emit(messageType, message);
            });

        });

        socket.on('disconnect', function() {
            if (socketUser !== null && userRegistry !== null) {
                log.debug('Unregistering user: ' + socketUser);
                pipe.unregister(socketUser, userRegistry);
                socketUser = userRegistry = null;
            }
        });
    });
    

    // set the server to listen to port 5886
    var port = options.port;
    if (port === null || port === undefined) {
        log.error('No listening socket port was configured.\n');
        process.exit(1);
    }
    server.listen(port);
}

function getConfiguration(configurationFile) {
    var config = ini.parse(fs.readFileSync(configurationFile, 'utf-8'));
    var mainConfig = config['app:main'];

    var host = mainConfig['notification.ws.local_server'];
    if (host) {
        host = host.split(':');
    } else {
        host = mainConfig['notification.ws.server'].split(':');
    }
    var port;
    if (host.length === 1) {
        port = 80;
    } else {
        port = parseInt(host[1], 10);
        if (isNaN(port)) {
            log.error('Port must be number. Got: ' + host[1]);
            process.exit(1);
        }
    }

    var cookieName = (mainConfig['beaker.session.key'] || '').trim();
    if (cookieName.length === 0) {
        log.error('We need a cookie session name');
        process.exit(1);
    }

    var notificationType = (
        mainConfig['notification.ws.notification_type'] || ''
    ).trim();
    if (notificationType.length === 0) {
        log.error('We need a notification type');
        process.exit(1);
    }
    
    return {
        cookieName: cookieName,
        notificationType: notificationType,
        port: port
    };
}

var requiredArguments = 2;
if (process.argv[0].indexOf('node') === 0) {
    requiredArguments++;
}

if (process.argv.length !== requiredArguments) {
    console.log('We need a INI configuration file');
    process.exit(1);
}

main(path.resolve(process.argv[requiredArguments - 1]));

