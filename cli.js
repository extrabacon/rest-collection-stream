#!/usr/bin/env node

var RCS = require('./')
var es = require('event-stream')

var rest = RCS(process.argv[2])

rest.on('error', function (err) {
  console.error("Response Error:", err)
})

rest.pipe(es.stringify()).pipe(process.stdout)
