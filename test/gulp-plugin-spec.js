var mock = require("mock-require");
var helper = require("./helper");
var createFile = helper.createFile;
var colors = require("ansi-colors");
var PluginError = require("plugin-error");

var logs = "";

mock("fancy-log", function () {
  var args = Array.prototype.slice.call(arguments);
  var log = args
    .map(function (arg) {
      return arg.toString();
    })
    .join(" ");
  log = colors.stripColor(log);
  logs += log + "\n";
});

var expect = require("../index");

function testStream(stream, callback) {
  var pipedFiles = [];
  var error = null;
  stream.on("data", function (file) {
    pipedFiles.push(file);
  });
  stream.on("error", function (err) {
    error = err;
  });
  stream.on("end", function () {
    callback(error, pipedFiles);
  });
  return stream;
}

describe("gulp-expect-file", function () {
  beforeEach(function () {
    logs = "";
  });

  context("with file names", function () {
    it("tests all files are expected", function (done) {
      var stream = expect(["foo.txt", "bar.txt"]);
      testStream(stream, function (error, files) {
        if (error) return done(error);
        files.should.have.length(2);
        logs.should.match(/PASS/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.write(createFile("bar.txt"));
      stream.end();
    });
  });

  context("with contents matcher", function () {
    it("tests file contents matches expectation", function (done) {
      var stream = expect({
        "foo.txt": "world",
        "bar.txt": /^hello/i,
      });
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.write(createFile("foo.txt", "Hello, world!"));
      stream.write(createFile("bar.txt", "Hello, earth!"));
      stream.end();
    });

    it("fails if file contents not matching expectation", function (done) {
      var stream = expect({ "foo.txt": "world" });
      testStream(stream, function () {
        logs.should.match(/FAIL: foo\.txt is not containing "world"/);
        done();
      });
      stream.write(createFile("foo.txt", "Hello, earth!"));
      stream.end();
    });
  });

  context("with empty array", function () {
    it("tests no files in stream", function (done) {
      var stream = expect([]);
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.end();
    });

    it("fails if any file is in stream", function (done) {
      var stream = expect([]);
      testStream(stream, function () {
        logs.should.match(/FAIL: foo\.txt is unexpected/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.end();
    });
  });

  context("with { reportUnexpected: true }", function () {
    it("should report unexpected files", function (done) {
      var stream = expect({ reportUnexpected: true }, "foo.txt");
      testStream(stream, function () {
        logs.should.match(/FAIL: bar\.txt is unexpected/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.write(createFile("bar.txt"));
      stream.end();
    });
  });

  context("with { reportUnexpected: false }", function () {
    it("should not report unexpected files", function (done) {
      var stream = expect({ reportUnexpected: false }, "foo.txt");
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.write(createFile("bar.txt"));
      stream.end();
    });
  });

  context("with { reportMissing: true }", function () {
    it("should report missing files", function (done) {
      var stream = expect({ reportMissing: true }, ["foo.txt", "bar.txt"]);
      testStream(stream, function () {
        logs.should.match(/FAIL: Missing 1 expected files: bar\.txt/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.end();
    });
  });

  context("with { reportMissing: false }", function () {
    it("should not report missing files", function (done) {
      var stream = expect({ reportMissing: false }, ["foo.txt", "bar.txt"]);
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.end();
    });
  });

  context("with { errorOnFailure: true }", function () {
    it("should emit error event if expectation failed", function (done) {
      var stream = expect({ errorOnFailure: true }, { "foo.txt": "world" });
      testStream(stream, function (err) {
        err.should.be.instanceof(PluginError);
        err.message.should.equal("Failed 1 expectations");
        done();
      });
      stream.write(createFile("foo.txt", "Hello, earth!"));
      stream.end();
    });
  });

  context("with { silent: true }", function () {
    it("should not write any logs", function (done) {
      var stream = expect({ silent: true }, ["foo.txt"]);
      testStream(stream, function () {
        logs.should.match(/^$/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.end();
    });
  });

  context("with { verbose: true }", function () {
    it("should also report passings", function (done) {
      var stream = expect({ verbose: true }, ["foo.txt"]);
      testStream(stream, function () {
        logs.should.match(/PASS: foo\.txt/);
        done();
      });
      stream.write(createFile("foo.txt"));
      stream.end();
    });
  });

  describe(".real", function () {
    var tempFile;

    before(function (done) {
      helper.createTemporaryFile(function (err, file) {
        if (err) return done(err);
        tempFile = file;
        done();
      });
    });

    after(function () {
      if (tempFile) {
        tempFile.cleanup();
      }
      tempFile = null;
    });

    it("tests if the files exists on file system", function (done) {
      var stream = expect.real([tempFile.relative]);
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.write(tempFile);
      stream.end();
    });

    it("should report if the file does not exists", function (done) {
      var stream = expect.real(["nonexists.txt"]);
      testStream(stream, function () {
        logs.should.match(/FAIL: nonexists\.txt is not on filesystem/);
        done();
      });
      stream.write(createFile("nonexists.txt"));
      stream.end();
    });

    it("passes with no files", function (done) {
      var stream = expect.real([]);
      testStream(stream, function () {
        logs.should.match(/PASS/);
        done();
      });
      stream.end();
    });
  });
});
