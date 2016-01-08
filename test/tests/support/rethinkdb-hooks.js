import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
const r = RethinkdbWebsocketClient.rethinkdb;

const tableNames = [
  'messages',
  'chat_rooms',
];

const options = {
  host: 'localhost',       // hostname of the websocket server
  port: 8000,              // port number of the websocket server
  path: '/',               // HTTP path to websocket route
  wsProtocols: ['binary'], // sub-protocols for websocket, required for websockify
  secure: false,           // set true to use secure TLS websockets
  db: 'orbit_rethinkdb',   // default database, passed to rethinkdb.connect
};

function dropDatabase(conn) {
  return r.dbList().run(conn).then((dbs) => {
    if (dbs.indexOf(options.db) === -1) return;
    return r.dbDrop(options.db).run(conn);
  });
}

function createDatabase(conn) {
  return r.dbCreate(options.db).run(conn);
}

function createSchema(conn) {
  return Promise.all(tableNames.map((tableName) => {
    return r.db(options.db).tableCreate(tableName).run(conn);
  }));
}

function clearSchema(conn) {
  return Promise.all(tableNames.map((tableName) => {
    return r.db(options.db).table(tableName).delete({durability: 'hard'}).run(conn);
  }));
}

let rethinkdbInitialized = false;

function setupRethinkdb() {

  return connection().then((conn) => {
    if (rethinkdbInitialized) return Promise.resolve(conn);

    return dropDatabase(conn)
      .then(() => { return createDatabase(conn); })
      .then(() => { return createSchema(conn); })
      .then(() => {
        rethinkdbInitialized = true;
        return conn;
      });
  });
}

function teardownRethinkdb() {
  return connection().then((conn) => {
    return clearSchema(conn);
  });
}

let conn = null;
function connection() {
  if (conn) Promise.resolve(conn);

  return RethinkdbWebsocketClient.connect(options).then((_conn) => {
    conn = _conn;
    return conn;
  });
}

export { setupRethinkdb, teardownRethinkdb, connection };
