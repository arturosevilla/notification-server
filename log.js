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

var log = require('custom-logger');

exports.DEBUG = -1;
exports.INFO = 0;
exports.WARN = 1;
exports.ERROR = 2;


var config = {
    format: '%timestamp% %event%:%padding% %message%',
    level: exports.INFO
};

exports.config = function(cfg) {
    for (var key in cfg) {
        if (config.hasOwnProperty(key)) {
            config[key] = cfg[key];
        }
    }
    log.config(config);
    return this;
}

log.new({
    debug: { color: 'cyan', level: exports.DEBUG, event: 'debug' }
});

exports.info = log.info;
exports.error = log.error;
exports.warn = log.error;
exports.debug = log.debug;

