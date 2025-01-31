// A mock APM server to use in tests.
//
// Usage:
//    const server = new MockAPMServer(opts)
//    server.start(function (serverUrl) {
//      // Test code using `serverUrl`...
//      // - Events received on the intake API will be on `server.events`.
//      // - Raw request data is on `server.requests`.
//      // - Use `server.clear()` to clear `server.events` and `server.requests`
//      //   for re-use of the mock server in multiple test cases.
//      // - Call `server.close()` when done.
//    })

const http = require('http')
const { URL } = require('url')
const zlib = require('zlib')

class MockAPMServer {
  // - @param {Object} opts
  //    - {String} opts.apmServerVersion - The version to report in the
  //      "GET /" response body. Defaults to "8.0.0".
  constructor (opts) {
    opts = opts || {}
    this.clear()
    this.serverUrl = null // set in .start()
    this.apmServerVersion = opts.apmServerVersion || '8.0.0'
    this._http = http.createServer(this._onRequest.bind(this))
  }

  clear () {
    this.events = []
    this.requests = []
  }

  _onRequest (req, res) {
    var parsedUrl = new URL(req.url, this.serverUrl)
    var instream = req
    if (req.headers['content-encoding'] === 'gzip') {
      instream = req.pipe(zlib.createGunzip())
    } else {
      instream.setEncoding('utf8')
    }

    let body = ''
    instream.on('data', (chunk) => {
      body += chunk
    })

    instream.on('end', () => {
      let resBody = ''
      if (req.method === 'GET' && parsedUrl.pathname === '/') {
        // https://www.elastic.co/guide/en/apm/server/current/server-info.html#server-info-endpoint
        res.writeHead(200)
        resBody = JSON.stringify({
          build_date: '2021-09-16T02:05:39Z',
          build_sha: 'a183f675ecd03fca4a897cbe85fda3511bc3ca43',
          version: this.apmServerVersion
        })
      } else if (parsedUrl.pathname === '/config/v1/agents') {
        // Central config mocking.
        res.writeHead(200)
        resBody = '{}'
      } else if (req.method === 'POST' && parsedUrl.pathname === '/intake/v2/events') {
        body
          .split(/\n/g) // parse each line
          .filter(line => line.trim()) // ... if it is non-empty
          .forEach(line => {
            this.events.push(JSON.parse(line)) // ... append to this.events
          })
        resBody = '{}'
        res.writeHead(202)
      } else {
        res.writeHead(404)
      }
      this.requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body
      })
      res.end(resBody)
    })
  }

  // Start listening and callback with `cb(serverUrl)`.
  start (cb) {
    return this._http.listen(() => {
      this.serverUrl = `http://localhost:${this._http.address().port}`
      cb(this.serverUrl)
    })
  }

  close () {
    return this._http.close()
  }
}

module.exports = {
  MockAPMServer
}
