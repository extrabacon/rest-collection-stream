# rest-collection-stream

A simple HTTP client for streaming JSON content from REST lists and collections. Includes extensive pagination support for continuous streaming across multiple HTTP requests.

Use this module to pull an entire collection of JSON documents from your favorite API into a Node.js stream! It will parse a response as JSON, extract content as objects, push it down the stream, and continue doing so as long as there is more data.

```js
var restCollection = require('rest-collection-stream');
restCollection('https://somecloudapp.io/api/v1/resource').pipe(/*somewhere*/);
```

## Installation

```bash
npm install rest-collection-stream
```

## Documentation

The module consists of a function returning a stream.

It's that simple.

Pulling data from an API is much more fun with streaming! Especially when paging is handled automatically...

```js
var restCollection = require('rest-collection-stream');
var fs = require('fs');
var es = require('event-stream');

restCollection('https://somecloudapp.io/api/v1/resource')
  .pipe(es.map(/* my mapping function */))
  .pipe(es.stringify())
  .pipe(fs.createWriteStream(backupFile));
```

More precisely, the function has the same signature as [request](https://github.com/mikeal/request), accepting the same [parameters and options](https://github.com/mikeal/request/blob/master/README.md#requestoptions-callback), but returning a stream instead of invoking a callback.

```js
var stream = restCollection(url, options);
```

In addition to request options, you may also set:
- `data` - a function for extracting content from the response
- `next` - a function for handling pagination

The following options are also enforced:
- `json` - always **true**, only JSON APIs are supported at the moment and the response body is always parsed as such
- `headers` - HTTP compression is enabled by default via `Accept-Encoding` - a nicety if you are pulling thousands of documents from your host

### Streaming objects from the response

By default, if the response body consists of an array, all elements are emitted down the stream.

If the response is an envelope object, commonly used properties will be inspected for an array of data. Those are (in order): `data`, `results`, `items`, `value` and `objects`.

#### Custom parsing

If the elements you want to stream are not found in those common properties, you can supply your own function to extract the elements. Your function is expected to return an array of items to emit down the stream.

To use a custom function for parsing the body, specify it as `data` in the options.

```js
restCollection(url, {
  data: function (res, body) {
    return body.items;
  }
}).pipe(...);
```

#### Custom streaming

You can also gain full control over what gets emitted by not returning values from your `data` function. Use `this.emit('data', item)` to send whatever you want, including results from an asynchronous function.

```js
restCollection(url, {
  data: function (res, body) {
    this.emit('data', { something: 'else' });
  }
}).pipe(...);
```

### Pagination

Another request for the next page data is automatically sent if there is more data available. The module implements common pagination support from popular APIs, but you can also supply your own.

#### Built-in pagination support

- Standard HTTP header `Link: <URL>; rel='next'`
- Common envelope properties
    + Facebook: `paging.next`
    + Google APIs: `nextLink`
    + OData 2.0 and 3.0: `__next`
    + OData 4.0: `@odata.nextLink`
    + AWS: `NextMarker`
- A self-incrementing `page` query string parameter

Should I support more APIs? Pull requests are welcome.

#### Custom paging

If your API works differently, you can provide you own paging function. The function can return the URL of the next page or query string parameters to apply on the next request. To stop pagination, return something falsy.

To use a custom function for pagination, specify it as `next` in the options.

```js
restCollection(url, {
  next: function (res, body) {
    return urlOfNextPage;
  }
}).pipe(...);
```

To specify the URL of the next page to request, return it as a string. The URL is automatically resolved using [url.resolve](http://nodejs.org/api/url.html#url_url_resolve_from_to).

To specify query string parameters instead, return an object. The key/value pairs will be applied on the next request. The current query string values can be accessed in `this.req.qs`.

```js
restCollection(url, {
  next: function (res, body) {
    // increment the page manually (we should also have a stop condition...)
    return { page: this.req.qs.page + 1 };
  }
}).pipe(...);
```

To use anything else, such as request headers, you may also access the request parameters using `this.req`. Any modification will be used onward for the next request. Make sure to return the URL, otherwise paging will stop.

```js
restCollection(url, {
  next: function (res, body) {
    // return the same URL - paging is controlled using headers instead
    this.req.headers['X-Page-Index'] = nextPage;
    return this.req.uri.href;
  }
}).pipe(...);
```

## Dependencies

+ [request](https://github.com/mikeal/request)

## License

The MIT License (MIT)

Copyright (c) 2014, Nicolas Mercier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
