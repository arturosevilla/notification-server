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

/* This module connects to Ckluster's notification pipe.
 * 
 * This notification pipe is implemented with ZeroMQ.
 */

var zmq = require('zmq'),
    log = require('./log.js'),
    ini = require('ini'),
    fs = require('fs'),
    user = require('./user.js');

log.config({ level: log.DEBUG });

function requestNotifiers(reqServerConfig, finiInitCallback) {
    /* we are connecting to a server that holds the information of the
     * publishers
     */
    var pubNotifierServer = zmq.socket('req');
    log.debug('Obtaining list of PUB notifiers');
    pubNotifierServer.connect(reqServerConfig);

    /* request publishers information  */
    pubNotifierServer.on('message', function(message) {
        var listOfNotifiers = null;
        try {
            listOfNotifiers = JSON.parse(message);
            if (listOfNotifiers.length === 0) {
                listOfNotifiers = null;
            }
        } catch(c) {
            listOfNotifiers = null;
        }

        finiInitCallback(listOfNotifiers);
    });

    /* init the whole request */
    pubNotifierServer.send(JSON.stringify({
        'type': 'get-publishers'
    }));
}

function initNotificationPipe(pubNotifierConfig, reqServerConfig, session) {
    var notifiers = {};
    var messageCallback = null;
    var registeredUsers = {};
    var notifierSocket = zmq.socket('sub');
    notifierSocket.on('message', function(message) {
        /* we received an encoded notification */
        message = message.toString();
        log.debug('Received notification: ' + message);
        var separation = message.indexOf('|');
        if (separation <= 0) {
            log.warn('Wrong serialization of message: ' + message);
            return;
        }
        var recipient = message.substr(0, separation);
        var notification = JSON.parse(message.substr(separation + 1));
        if (!registeredUsers.hasOwnProperty(recipient)) {
            return;
        }

        var registrations = registeredUsers[recipient];
        var x;
        for (x in registrations) {
            /* callbacks in each registration */
            registrations[x].callback(notification);
        }
    });

    function doSubscribe(notifier, user) {
        notifierSocket.subscribe(user);
        notifier.subscribers[user] = true;
    }

    function doUnsubscribe(notifier, user) {
        notifierSocket.unsubscribe(user);
        delete notifier.subscribers[user];
    }

    function subscribeToUserNotifications(user) {
        log.debug('Subscribing to user notification channel: ' + user);
        var x;
        for (x in notifiers) {
            if (notifiers.hasOwnProperty(x) &&
                !notifiers[x].subscribers.hasOwnProperty(user)) {
                doSubscribe(notifiers[x], user);
            }
        }
    }

    function unsubscribeToUserNotifications(user) {
        log.debug('Unsubscribing to user notification channel: ' + user);
        var x;
        for (x in notifiers) {
            if (notifiers.hasOwnProperty(x) &&
                !notifiers[x].subscribers.hasOwnProperty(user)) {
                doUnsubscribe(notifiers[x], user);
            }
        }

    }

    function addPublisher(address) {
        /* dont duplicate a connection */
        if (notifiers.hasOwnProperty(address)) {
            log.debug('Found duplicate: ' + address + '. Ignoring...');
            return;
        }

        /* connect to a notifier queue. At first we are not going to receive
         * messages because we need to subscribe to a given filter (user ids)
         */
        notifierSocket.connect(address);
        var notifier = {
            subscribers: {}
        };
        notifiers[address] = notifier;

        /* subscribe the already registered users */
        var user;
        for (user in registeredUsers) {
            if (registeredUsers.hasOwnProperty(user)) {
                doSubscribe(notifier, user);
            }
        }

        log.debug('Connected to PUB notifier');
    }
    
    requestNotifiers(reqServerConfig, function(notAddresses) {
        if (notAddresses === null) {
            log.error('Should not get an empty list of PUB notifiers');
            return null;
        }

        log.debug('Connecting to ' + notAddresses.length + ' PUB notifiers');
        var x;
        for (x in notAddresses) {
            addPublisher(notAddresses[x]);
        }
    });

    /* right now we are connected to all the available notification publishers,
     * however if in the future more are available then the following socket
     * will notify us and will create the necessary connections.
     */

    var publisherNotifier = zmq.socket('sub');
    publisherNotifier.subscribe('');
    publisherNotifier.connect(pubNotifierConfig);
    publishers = [];
    publisherNotifier.on('message', function(msg) {
        msg = msg.toString();
        log.debug('Received list of publishers: ' + msg);
        var receivedPublishers = JSON.parse(msg);
        var x;
        for (x in receivedPublishers) {
            addPublisher(receivedPublishers[x]);
        }
    });

    return {
        getUser: function(cookieValue, callback) {
            session.getUser(cookieValue, callback);
        },
        register: function(user, callback) {
            var registryEntry = {
                user: user,
                callback: callback
            };
            if (!registeredUsers.hasOwnProperty(user)) {
                /* we must subscribe to the socket also! */
                registeredUsers[user] = [];
                subscribeToUserNotifications(user);
            }
            registeredUsers[user].push(registryEntry);
            return registryEntry;
        },
        unregister: function(user, registry) {
            if (!registeredUsers.hasOwnProperty(user)) {
                return;
            }
            var registryPosition = registeredUsers[user].indexOf(registry);
            if (registryPosition >= 0) {
                registeredUsers[user].splice(registryPosition, 1);
            }
            if (registeredUsers[user].length === 0) {
                /* we dont have any registered users so we unsubscribe also from
                 * the socket
                 */
                delete registeredUsers[user];
                unsubscribeToUserNotifications(user);
            }
        }
    };
}

exports.initNotificationPipe = function(configFile) {
    var config = ini.parse(fs.readFileSync(configFile, 'utf-8'));
    var mainConfig = config['app:main'];
    var pubNotifierConfig = mainConfig['notification.queue.worker.notifier.pub'];
    var reqServerConfig = mainConfig['notification.queue.worker.notifier.req'];
    var hmacSecret = mainConfig['beaker.session.secret'];
    var sessionUrl = mainConfig['beaker.session.urls'];
    log.debug('Publisher notifier config: ' + pubNotifierConfig);
    log.debug('Publisher server config: ' + reqServerConfig);
    var userRetrieval = user.initUserRetrieval(log, hmacSecret, sessionUrl);
    if (userRetrieval === null) {
        return null;
    }

    return initNotificationPipe(
        pubNotifierConfig,
        reqServerConfig,
        userRetrieval
    );
};

