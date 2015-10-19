var concat     = require('broccoli-sourcemap-concat');
var Funnel     = require('broccoli-funnel');
var mergeTrees = require('broccoli-merge-trees');
var compileES6Modules = require('broccoli-es6modules');
var transpileES6 = require('broccoli-babel-transpiler');
var jshintTree = require('broccoli-jshint');
var replace    = require('broccoli-string-replace');
var gitVersion = require('git-repo-version');
var browserify = require('broccoli-browserify');
var writeFile = require('broccoli-file-creator');

// extract version from git
// note: remove leading `v` (since by default our tags use a `v` prefix)
var version = gitVersion().replace(/^v/, '');

var packages = [
  {
    name: 'orbit-rethinkdb',
    include: [/orbit-rethinkdb\/.*.js/]
  }
];

var loader = new Funnel('bower_components', {
  srcDir: 'loader',
  files: ['loader.js'],
  destDir: '/assets/'
});

var globalizedLoader = new Funnel('build-support', {
  srcDir: '/',
  files: ['globalized-loader.js'],
  destDir: '/assets/'
});

var generatedBowerConfig = new Funnel('build-support', {
  srcDir: '/',
  destDir: '/',
  files: ['bower.json']
});

generatedBowerConfig = replace(generatedBowerConfig, {
  files: ['bower.json'],
  pattern: {
    match: /VERSION_PLACEHOLDER/,
    replacement: function() {
      return version;
    }
  }
});

var tests = new Funnel('test', {
  srcDir: '/tests',
  include: [/.js$/],
  destDir: '/tests'
});

var buildExtras = new Funnel('build-support', {
  srcDir: '/',
  destDir: '/',
  files: ['README.md', 'LICENSE']
});

var lib = {};
var main = {};
var globalized = {};

packages.forEach(function(package) {
  lib[package.name] = new Funnel('lib', {
    srcDir: '/',
    include: package.include,
    exclude: package.exclude || [],
    destDir: '/'
  });

  main[package.name] = mergeTrees([ lib[package.name] ]);
  main[package.name] = new compileES6Modules(main[package.name]);
  main[package.name] = new transpileES6(main[package.name]);
  main[package.name] = concat(main[package.name], {
    inputFiles: ['**/*.js'],
    outputFile: '/' + package.name + '.amd.js'
  });

  var support = new Funnel('build-support', {
    srcDir: '/',
    files: ['iife-start.js', 'globalize-' + package.name + '.js', 'iife-stop.js'],
    destDir: '/'
  });

  var loaderTree = (package.name === 'orbit' ? loader : globalizedLoader);
  var loaderFile = (package.name === 'orbit' ? 'loader.js' : 'globalized-loader.js');

  globalized[package.name] = concat(mergeTrees([loaderTree, main[package.name], support]), {
    inputFiles: ['iife-start.js', 'assets/' + loaderFile, package.name + '.amd.js', 'globalize-' + package.name + '.js', 'iife-stop.js'],
    outputFile: '/' + package.name + '.js'
  });
});

var allLib = mergeTrees(Object.keys(lib).map(function(package) {
  return lib[package];
}));
var allMain = mergeTrees(Object.keys(main).map(function(package) {
  return main[package];
}));
var allGlobalized = mergeTrees(Object.keys(globalized).map(function(package) {
  return globalized[package];
}));

var jshintLib = jshintTree(allLib);
var jshintTest = jshintTree(tests);

var mainWithTests = mergeTrees([allLib, tests, jshintLib, jshintTest]);

mainWithTests = new compileES6Modules(mainWithTests);
mainWithTests = new transpileES6(mainWithTests);

mainWithTests = concat(mainWithTests, {
  inputFiles: ['**/*.js'],
  outputFile: '/assets/tests.amd.js'
});

mainWithTests = replace(mainWithTests, {
  files: "/assets/tests.amd.js",
  patterns: []
});

var vendor = concat('bower_components', {
  inputFiles: [
    'jquery/dist/jquery.js',
    'rsvp/rsvp.js',
    'orbit.js/orbit.amd.js',
    'orbit.js/orbit-common.amd.js'],
  outputFile: '/assets/vendor.js'
});

var qunit = new Funnel('bower_components', {
  srcDir: '/qunit/qunit',
  files: ['qunit.js', 'qunit.css'],
  destDir: '/assets'
});

var testSupport = concat('test', {
  inputFiles: ['../test/test-support/sinon.js', '../test/test-support/test-shims.js', '../test/test-support/test-loader.js'],
  outputFile: '/assets/test-support.js'
});

var testIndex = new Funnel('test', {
  srcDir: '/',
  files: ['index.html'],
  destDir: '/tests'
});

function generateNpmStubs(moduleNames) {
  return moduleNames.map(function(moduleName){
    return "define('npm:" +
      moduleName +
      "', function(){ return { 'default': require('" +
      moduleName +
      "')};})";
  }).join("\n");
}

var browserifyExports = writeFile('/browserify-exports.js', generateNpmStubs([
  'rethinkdb',
  'rethinkdb-websocket-client'
]));

var testNpmModules = browserify(browserifyExports, {
  entries: ['./browserify-exports.js'],
  outputFile: '/assets/test-npm-modules.js'
});


module.exports = mergeTrees([loader, globalizedLoader, allMain,
  allGlobalized, mainWithTests, vendor, qunit, testSupport, testIndex,
  generatedBowerConfig, buildExtras, testNpmModules]);
