var request = require('request');
var zlib = require('zlib');
var parseUrl = require('url').parse;
var resolveUrl = require('url').resolve;
var es = require('event-stream');

var isUrl = RegExp.prototype.test.bind(/^http(s)?:/);
var parseLink = RegExp.prototype.exec.bind(/<(.+?)>;\s*rel=['"]?next['"]?/);

function isObject(obj) {
  return obj === Object(obj);
}

var defaults = {
  data: function (res, body) {
    // body is an array, return as-is
    if (Array.isArray(body)) return body;
    // body is an envelope, look for commonly used properties
    var keys = ['data', 'results', 'items', 'value', 'objects'];
    for (var i = 0, len = keys.length; i < len; i++) {
      if (!(keys[i] in body)) continue;
      var value = body[keys[i]];
      if (Array.isArray(value)) return value;
    }
    // unable to detect collection items, need to provide your own function
    return null;
  },
  next: function (res, body) {
    // inspect the "Link" header
    if (res.headers) {
      var match = parseLink(res.headers.Link || res.headers.link);
      if (match) return match[1];
    }
    // look for commonly used properties
    if (body.paging && body.paging.next) return body.paging.next;
    if (body.meta && body.meta.next) return body.meta.next;
    //   Google APIs
    if (typeof body.nextLink === 'string') return body.nextLink;
    //   OData 2.0 and 3.0
    if (typeof body.__next === 'string') return body.__next;
    //   OData 4.0
    if (body['@odata.nextLink']) return body['@odata.nextLink'];
    //   AWS
    if (typeof body.NextMarker === 'string') {
      return { Marker: body.NextMarker };
    }
    // inspect the query string
    if (typeof this.req.qs.page === 'number') {
      // increment page if current page has data
      var data = this.req.data(res, body);
      if (data && data.length) {
        return { page: this.req.qs.page + 1 };
      }
    }
    // need to provide your own function (should we look for more?)
    return null;
  }
};

var restCollection = function (url, o) {

  if (isObject(url)) {
    o = url;
    url = null;
  }

  var options = {
    uri: url ? parseUrl(url) : null,
    qs: {},
    headers: {},
    json: true,
    data: defaults.data,
    next: defaults.next
  };

  o && Object.keys(o).forEach(function (key) {
    options[key] = o[key];
  });

  // setup headers - only JSON is supported
  options.headers = options.headers || {};
  options.headers.Accept = 'application/json';
  options.headers['Accept-Encoding'] = 'gzip, deflate';

  return es.readable(function (count, callback) {
    // nowhere to go next, end the stream
    if (!options.uri) return this.emit('end');

    var req = restCollection.request || requestWithEncoding;
    var stream = this;
    options.pageIndex = count;
    stream.req = options;

    req(options, function (err, res, body) {
      if (err) return stream.emit('error', err);
      stream.emit('page', options, res, body);

      var data = options.data.call(stream, res, body);
      if (data) {
        if (Array.isArray(data)) {
          // data is an array: emit all elements individually
          data.forEach(function (obj) {
            stream.emit('data', obj);
          });
        } else {
          // data is something else: emit as-is
          stream.emit('data', data);
        }
      }

      var nextPage = options.next.call(stream, res, body);
      if (isObject(nextPage)) {
        // nextPage is an object: use as querystring parameters
        Object.keys(nextPage).forEach(function (key) {
          options.qs[key] = nextPage[key];
        });
      } else if (typeof nextPage === 'string') {
        if (isUrl(nextPage)) {
          // a full URL (starting with http:)
          options.uri = parseUrl(nextPage);
        } else {
          // resolve the URL
          options.uri = parseUrl(resolveUrl(options.uri.href, nextPage));
        }
      } else {
        // no nextPage, next iteration will end the stream
        options.uri = null;
      }

      callback();
    });
  });

};

// http compression support for request
// borrowed from https://gist.github.com/nickfishman/5499763
function requestWithEncoding(options, callback) {
  var req = request(options);
  req.on('response', function (res) {
    var chunks = [];
    res.on('data', function (chunk) {
      chunks.push(chunk);
    }).on('end', function () {
      var buffer = Buffer.concat(chunks);
      var encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        zlib.gunzip(buffer, function (err, decoded) {
          callback(err, res, decoded && JSON.parse(decoded.toString()));
        });
      } else if (encoding === 'deflate') {
        zlib.inflate(buffer, function (err, decoded) {
          callback(err, res, decoded && JSON.parse(decoded.toString()));
        });
      } else {
        callback(null, res, JSON.parse(buffer.toString()));
      }
    });
  });
  req.on('error', function (err) {
    callback(err);
  });
}

module.exports = restCollection;
