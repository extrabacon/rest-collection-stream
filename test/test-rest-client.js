require('should');
var restCollection = require('../');
var es = require('event-stream');

describe('restCollection API', function () {
  it('should return a stream', function () {
    restCollection.request = function (options, callback) {
      callback(null, {}, []);
    };
    var stream = restCollection('http://host/someapi');
    stream.should.have.properties('pipe', 'pause', 'resume');
    stream.pipe.should.be.a.Function;
    stream.pause.should.be.a.Function;
    stream.resume.should.be.a.Function;
  });
  it('should apply options', function () {
    restCollection.request = function (options, callback) {
      options.uri.href.should.eql('http://host/someapi');
      options.qs.should.eql({ $top: 100 });
      options.headers.should.containEql({
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'X-Header': 'value'
      });
      options.should.containEql({ someOption: true });
      options.json.should.be.true;
      options.data.should.be.a.Function;
      options.next.should.be.a.Function;
    };
    restCollection('http://host/someapi', {
      qs: { $top: 100 },
      headers: { 'X-Header': 'value' },
      someOption: true
    });
  });
  it('should support stream piping', function () {
    restCollection.request = function (options, callback) {
      callback(null, {}, [1, 2, 3, 4, 5]);
    };
    restCollection('http://host/someapi')
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5');
      }));
  });
  it('should parse data when response body has an envelope', function (done) {
    restCollection.request = function (options, callback) {
      callback(null, {}, {
        meta: { important: true },
        data: [1, 2, 3, 4, 5]
      });
    };
    restCollection('http://host/someapi')
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5');
      }))
      .on('end', done);
  });
  it('should parse data with a custom function', function (done) {
    restCollection.request = function (options, callback) {
      callback(null, {}, {
        very: {
          unusual: [
            { data: [1, 2, 3, 4, 5] }
          ]
        }
      });
    };
    function unusualParser(res, body) {
      return body.very.unusual[0].data;
    }
    restCollection('http://host/someapi', { data: unusualParser })
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5');
      }))
      .on('end', done);
  });
  it('should paginate with the "Link" header', function (done) {
    restCollection.request = function (options, callback) {
      if (options.uri.path === '/someapi/page1') {
        callback(null, {
          headers: { 'Link': '<http://host/someapi/page2>; rel=\'next\'' }
        }, {
          data: [1, 2, 3]
        });
      } else if (options.uri.path === '/someapi/page2') {
        callback(null, {
          headers: { 'Link': '<http://host/someapi/page3>; rel=\'next\'' }
        }, {
          data: [4, 5, 6],
        });
      } else {
        callback(null, {
          headers: {}
        }, {
          data: [7, 8]
        });
      }
    };
    restCollection('http://host/someapi/page1')
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5,6,7,8');
      }))
      .on('end', done);
  });
  it('should paginate with common body fields', function (done) {
    restCollection.request = function (options, callback) {
      if (options.uri.path === '/someapi/page1') {
        callback(null, {}, {
          data: [1, 2, 3],
          paging: { next: '/someapi/page2' }
        });
      } else if (options.uri.path === '/someapi/page2') {
        callback(null, {}, {
          data: [4, 5, 6],
          nextLink: 'http://host/someapi/page3'
        });
      } else {
        callback(null, {}, { data: [7, 8] });
      }
    };
    restCollection('http://host/someapi/page1')
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5,6,7,8');
      }))
      .on('end', done);
  });
  it('should paginate with the query string', function (done) {
    var data = [1, 2, 3, 4, 5, 6, 7, 8];
    restCollection.request = function (options, callback) {
      var index = (+options.qs.page - 1) * 3;
      callback(null, {}, data.slice(index, index + 3));
    };
    restCollection('http://host/someapi', { qs: { page: 1 }})
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5,6,7,8');
      }))
      .on('end', done);
  });
  it('should paginate with a custom function', function (done) {
    var data = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    restCollection.request = function (options, callback) {
      var index = (+options.qs.$page_index || 0) * 3;
      callback(null, {
        headers: {
          'X-Page-Index': options.qs.$page_index || 0,
          'X-Page-Count': 3
        }
      }, data.slice(index, index + 3));
    };
    function customPager(res, body) {
      var index = +res.headers['X-Page-Index'];
      var count = +res.headers['X-Page-Count'];
      if (index < count - 1) {
        // set query string parameter computed from response headers
        return { $page_index: index + 1 };
      }
      return null;
    }
    restCollection('http://host/someapi', { next: customPager })
      .pipe(es.join(','))
      .pipe(es.wait(function (err, text) {
        text.should.be.exactly('1,2,3,4,5,6,7,8,9');
      }))
      .on('end', done);
  });
});

