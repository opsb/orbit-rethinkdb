var http = require('http');
var wsListen = require('rethinkdb-websocket-server').listen;

var httpServer = http.createServer();
wsListen({httpServer: httpServer, unsafelyAllowAnyQuery: true});
httpServer.listen(8000);
