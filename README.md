# orbit-rethinkdb

rethinkdb adapter for orbit.js

WARNING this is very much a WIP!

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](http://git-scm.com/)
* [Node.js](http://nodejs.org/) (with NPM)
* [Bower](http://bower.io/)
* [PhantomJS](http://phantomjs.org/)
* [Fswatch](https://github.com/emcrisostomo/fswatch) # required by autoload, brew install fswatch
* [Terminal Notifier](https://github.com/alloy/terminal-notifier) # required by autoload, brew install terminal-notifier
* [Broccoli-cli](https://github.com/broccolijs/broccoli-cli) # required by autoload, npm -g install broccoli-cli

## Installation

* `git clone <repository-url>` this repository
* change into the new directory
* npm install

## Running

* change into the new directory
* ./autoload
* change a file within lib, test and the ./builder script will be called
  this will run the server on http://localhost:4200
