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
    path = require('path');

function main(configurationFile, cookieValue) {
    var pipe = notifications.initNotificationPipe(configurationFile);
    if (pipe === null) {
        log.error('Unable to connect or an error occurred');
        process.exit(1);
    }

    pipe.getUser(cookieValue, function(user) {
        if (user === null) {
            console.log('There is no such session cookie: ' + cookieValue);
            process.exit(1);
        }
        pipe.register(user, function(message) {
            console.log(message);
        });
    });

}

var requiredArguments = 3;
if (process.argv[0].indexOf('node') === 0) {
    requiredArguments++;
}

if (process.argv.length !== requiredArguments) {
    console.log('We need a INI configuration file and a cookie value');
    process.exit(1);
}

main(
    path.resolve(process.argv[requiredArguments - 2]),
    process.argv[requiredArguments - 1]
);

