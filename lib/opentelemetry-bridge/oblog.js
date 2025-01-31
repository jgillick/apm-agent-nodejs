'use strict'

// This is the (O)penTelemetry (B)ridge (LOG) facility.
//
// It is used for development/debugging of the OTel Bridge to emit a log line
// for (almost) every OTel API call. OTel Bridge implementations typically
// call `oblog.apicall(...)`. During development/debugging there is a block in
// "setup.js" that is enabled to turn this logging on. This should always be
// disabled for any release code.

module.exports = {
  setApiCallLogFn (logFn) {
    module.exports.apicall = logFn
  },

  apicall () {}
}
