const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const { v4: uuidv4 } = require('uuid');
const Router = require("koa-router");
const cors = require('@koa/cors');
const WS = require('ws');

const app = new Koa();

const clients = new Set();
const users = [];
const messages = [];

app.use(koaBody({
  urlencoded: true,
  multipart: true,
  json: true,
}));

app.use(cors({
    origin: '*',
    credentials: true,
    'Access-Control-Allow-Origin': true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const router = new Router();

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback())
server.listen( port , () => console.log('server started'));
const wsServer = new WS.Server({server});

wsServer.on('connection', (ws, req) => {
  const errCallback = (err) => {
    if (err) {
      console.log(err);
    }
  }

  ws.on('message', msg => {
    const request = JSON.parse(msg);
    if (request.type === 'addUser') {
      if (users.find(user => user.name === request.name)) {
        ws.send('Никнейм занят', errCallback('Никнейм занят'));
      } else {
        clients.add(ws)
        console.log(clients.size);
        users.push({
          name: request.name,
          id: uuidv4()
        })
        Array.from(wsServer.clients)
          .filter(o => o.readyState === WS.OPEN)
          .forEach(o => {
            o.send(JSON.stringify(users));
            o.send(JSON.stringify(messages));
          });
      }
      return;
    }

    if (request.type === 'sendMessage') {
      messages.push({
        name: request.name,
        text: request.text
      });
      Array.from(wsServer.clients)
        .filter(o => o.readyState === WS.OPEN)
        .forEach(o => o.send(JSON.stringify(messages)));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(clients.size);
  })
});
