// server.js — json-server に型強制ミドルウェアを追加
const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

const NUM_KEYS = new Set(['id','userid','bookid','departmentid','positionid','progress']);
const looksNum = v => typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v));

function coerce(node) {
  if (Array.isArray(node)) return node.map(coerce);
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const lower = k.toLowerCase();
      if (node[k] && typeof node[k] === 'object') {
        node[k] = coerce(node[k]);
      } else if (lower !== 'date' && !lower.endsWith('date') &&
                 (NUM_KEYS.has(lower) || lower.endsWith('id'))) {
        if (looksNum(node[k])) node[k] = Number(node[k]);
      }
    }
  }
  return node;
}

// すべての書き込み系で型を矯正
server.use((req, res, next) => {
  if (['POST','PUT','PATCH'].includes(req.method) && req.body) {
    req.body = coerce(req.body);
  }
  next();
});

server.use(router);
server.listen(4000, () => {
  console.log('JSON Server (with type guard) is running on :4000');
});
