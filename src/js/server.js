const http = require('http');
const Koa = require('koa');
const WS = require('ws');
const uuid = require('uuid');

const app = new Koa();

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*' };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set(
        'Access-Control-Allow-Headers',
        ctx.request.get('Access-Control-Request-Headers'),
      );
    }

    ctx.response.status = 204;
  }
});

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });
let wsClients = [];
const chatMessages = [];

wsServer.on('connection', (ws, req) => {
  ws.on('close', () => {
    const closedWS = wsClients.find((closed) => closed.ws === ws);
    if (!closedWS) return;
    const { nickname } = closedWS;
    wsClients = wsClients.filter((user) => user.nickname !== nickname);
    const chatUsers = wsClients.map((user) => user.nickname);
    if (!chatUsers.length) return;

    const responseUserExit = {
      type: 'userLogout',
      nickname,
      data: chatUsers,
    };

    [...wsServer.clients]
      .filter((client) => client.readyState === WS.OPEN)
      .forEach((client) => client.send(JSON.stringify(responseUserExit)));
  });

  ws.on('message', (msg) => {
    let jsonMsg;
    try {
      jsonMsg = JSON.parse(msg);
    } catch (e) {
      console.log('e: ', e);
      console.log('e.name: ', e.name);
    }

    if (!jsonMsg) return;

    switch (jsonMsg.type) {
      case 'login':
        const loggedUser = wsClients.find((user) => user.nickname === jsonMsg.nickname);

        if (loggedUser) {
          const responseMessage = {
            type: 'loginReject',
            message: `Access denied: nickname <${jsonMsg.nickname}> has already exist!`,
          };

          ws.send(JSON.stringify(responseMessage));
        }

        if (!loggedUser) {
          wsClients.push({
            ws,
            nickname: jsonMsg.nickname,
          });

          const chatUsers = wsClients.map((user) => user.nickname);

          const responseLoginSuccess = {
            type: 'loginSuccess',
            message: jsonMsg.nickname,
            data: chatUsers,
            history: chatMessages,
          };

          ws.send(JSON.stringify(responseLoginSuccess));

          const responseNewUserLoggedToAll = {
            type: 'newUserLogged',
            message: jsonMsg.nickname,
          };

          [...wsServer.clients]
            .filter((client) => client.readyState === WS.OPEN)
            .forEach((client) => client.send(JSON.stringify(responseNewUserLoggedToAll)));
        }

        break;

      case 'message':
        chatMessages.push(jsonMsg);
        console.log('chatMessages: ', chatMessages);
        [...wsServer.clients]
          .filter((client) => client.readyState === WS.OPEN)
          .forEach((client) => client.send(msg));

        break;
      default:
        console.log('default case jsonMsg.type: ', jsonMsg.type);
        break;
    }
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log('Error occured:', err);
    return;
  }
  console.log(`server is listening on ${port}`);
});