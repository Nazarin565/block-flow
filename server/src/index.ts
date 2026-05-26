import http from 'node:http';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import config from './config.js';
import './db/client.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = http.createServer(app);

function startServer() {
  httpServer.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
  });
}

// Only bind the port when this file is the entrypoint, not when imported by tests or other modules.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

export { httpServer, app };
