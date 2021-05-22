var File = require("vinyl");
var Stream = require("stream");
var temp = require("temp");
var path = require("path");
var ExpectationError = require("../lib/errors").ExpectationError;

module.exports.should = require("should");

Function.prototype.expectFail = function (expectedError) {
  var _this = this;
  return function (err) {
    if (err) {
      if (!(err instanceof ExpectationError)) {
        return _this(err);
      }

      if (expectedError) {
        try {
          var message = err.message;
          if (typeof expectedError === "string") {
            message.should.equal(expectedError);
          } else if (typeof expectedError === "function") {
            expectedError(err);
          } else if (expectedError instanceof RegExp) {
            message.should.match(expectedError);
          }
        } catch (e) {
          _this(e);
          return;
        }
      }
      _this();
    } else {
      _this(new Error("Expectation should fail"));
    }
  };
};

module.exports.createFile = function (relpath, contents) {
  if (typeof contents === "string") {
    contents = new Buffer(contents);
  }
  if (contents instanceof Array) {
    contents = (function () {
      var stream = new Stream.PassThrough();
      contents.forEach(function (item) {
        stream.push(item);
      });
      stream.push(null);
      return stream;
    })();
  }
  return new File({
    cwd: "/test/",
    base: "/test/",
    path: "/test/" + relpath,
    contents: contents ? contents : null,
  });
};

module.exports.createTemporaryFile = function (callback) {
  temp.track();
  temp.open("gulp-expect-file", function (err, info) {
    if (err) return callback(err, null);

    var file = new File({
      cwd: path.dirname(info.path),
      base: path.dirname(info.path),
      path: info.path,
      contents: null,
    });
    file.cleanup = function () {
      temp.cleanup();
    };

    callback(null, file);
  });
};
