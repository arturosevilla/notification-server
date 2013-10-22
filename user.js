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

var crypto = require('crypto'),
    redis = require('redis'),
    log = require('./log.js'),
    pickle = require('./pickle.js');

exports.initUserRetrieval = function(log, secret, redisUrl) {

    if (redisUrl.indexOf(':') === -1) {
        return null;
    }
    var splitted = redisUrl.split(':');
    var redisPort = Number(splitted[1]);
    if (isNaN(redisPort)) {
        return null;
    }
    var redisHost = splitted[0] && splitted[0].trim();
    if (redisHost.length === 0) {
        return null;
    }

    function getSessionId(cookieValue) {
        if (cookieValue.length === 0) {
            return null;
        }
        var possibleSessionId = cookieValue.substr(40);
        var hmac = crypto.createHmac('sha1', secret);
        var signature = hmac.update(possibleSessionId).digest('hex');
        var givenSignature = cookieValue.substr(0, 40);

        // the following code reviews bits as assigned by Beaker (session
        // manager in the backend)
        var checker = 0;
        if (signature.length !== givenSignature.length) {
            return null;
        }
        for (var i = 0; i < signature.length; i++) {
            if (signature.charAt(i) != givenSignature.charAt(i)) {
                checker++;
            }
        }

        if (checker > 0) {
            return null;
        }
        return possibleSessionId;
    }

    return {
        getUser: function(cookieValue, callback) {
            var sessionId = getSessionId(cookieValue);
            if (sessionId === null) {
                callback(null);
                return;
            }

            log.debug('Session ID: ' + sessionId);

            var redisClient = redis.createClient(redisPort, redisHost);
            redisClient.get(
                'beaker:' + sessionId + ':session',
                function(err, reply) {
                    redisClient.quit();
                    if (err) {
                        log.error(err);
                        callback(null);
                        return;
                    }
                    // the session data is pickled in redis
                    var sessionData = pickle.loads(reply.toString());
                    var repozeTkt = sessionData['repoze.who.tkt'];
                    if (repozeTkt === undefined) {
                        callback(null);
                        return;
                    }

                    // we have to access it as an array because of the pickle
                    // library (that's weird)
                    var userid = repozeTkt[0]['user.id']
                    if (userid === undefined) {
                        callback(null);
                        return;
                    }
                    log.debug('Accessed information for: ' + userid[0]);
                    callback(userid[0]);
                }
            );

        }
    };
};

