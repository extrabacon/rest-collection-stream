#!/usr/bin/env node

var RCS = require('./')
var ndjson = require('ndjson')

var rest = RCS(process.argv[2], {
  next: function (res, body) {
    return body.links.next
  }
})

rest.on('error', function (err) {
  console.error("Response Error:", err)
})

rest.pipe(ndjson.serialize()).pipe(process.stdout)
