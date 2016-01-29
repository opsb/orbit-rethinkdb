import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
const r = RethinkdbWebsocketClient.rethinkdb;

const tableNames = [
  'alter_egos',
  'messages',
  'chat_rooms',
  'users',
];

const options = {
  host: 'localhost',       // hostname of the websocket server
  port: 8000,              // port number of the websocket server
  path: '/',               // HTTP path to websocket route
  wsProtocols: ['binary'], // sub-protocols for websocket, required for websockify
  secure: false,           // set true to use secure TLS websockets
  db: 'orbit_rethinkdb',   // default database, passed to rethinkdb.connect
};

function prepareDatabase(conn) {
  return r.dbList().run(conn).then((dbs) => {
    if (dbs.indexOf(options.db) !== -1) return;
    return r.dbCreate(options.db).run(conn);
  });
}

function prepareSchema(conn) {
  return r.db(options.db).tableList().run(conn)
    .then(existingTables => {
      return Promise.all(tableNames.map((tableName) => {
        if (existingTables.indexOf(tableName) === -1) {
          r.db(options.db).tableCreate(tableName).run(conn);
        }
      }));
    })
    .then(() => {
      return tableNames.map(tableName => {
        return r.db(options.db).table(tableName).delete({durability: 'hard'}).run(conn);
      });
    });
}

function setupRethinkdb() {
  return setupConnection().then((conn) => {
    return prepareDatabase(conn)
      .then(() => prepareSchema(conn))
      .then(() => conn);
  });
}

let conn = null;

function teardownRethinkdb() {
  return Promise.resolve();
}

function setupConnection() {
  return RethinkdbWebsocketClient.connect(options).then((_conn) => {
    conn = _conn;
    return conn;
  });
}

export { setupRethinkdb, teardownRethinkdb };
