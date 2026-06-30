/**
 * Conseal Electron shell — desktop window only (not a browser tab).
 *
 * Serves the static Next.js export over a local HTTP server so /_next/ assets load
 * correctly (file:// breaks absolute asset paths).
 *
 * Start the Python sidecar separately before launching:
 *   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
 */

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const IS_DEV = process.env.CONSEAL_DEV === '1';
const SIDECAR_HOST = '127.0.0.1';
const SIDECAR_PORT = 8000;

let mainWindow = null;
let staticServer = null;
let staticServerPort = null;

function getStaticRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'out');
  }
  return path.join(__dirname, '..', 'out');
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.woff2':
      return 'font/woff2';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function resolveStaticPath(rootDir, requestUrl) {
  const urlPath = decodeURIComponent(requestUrl.split('?')[0]);
  const relativePath = urlPath === '/' ? '/index.html' : urlPath;
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(rootDir, normalized);

  if (!filePath.startsWith(rootDir)) {
    return null;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    return fs.existsSync(indexPath) ? indexPath : null;
  }

  return fs.existsSync(filePath) ? filePath : null;
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const filePath = resolveStaticPath(rootDir, request.url || '/');

      if (!filePath) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Failed to read file');
          return;
        }

        response.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
        response.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      staticServer = server;
      staticServerPort = typeof address === 'object' && address ? address.port : null;
      resolve(staticServerPort);
    });
  });
}

function stopStaticServer() {
  if (!staticServer) return;
  staticServer.close();
  staticServer = null;
  staticServerPort = null;
}

function probeSidecar() {
  return new Promise((resolve) => {
    const request = http.get(
      { host: SIDECAR_HOST, port: SIDECAR_PORT, path: '/health', timeout: 2000 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Conseal',
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    await mainWindow.loadURL('http://localhost:3000');
  } else {
    const staticRoot = getStaticRoot();
    const indexPath = path.join(staticRoot, 'index.html');

    if (!fs.existsSync(indexPath)) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Conseal — Missing build',
        message: 'Desktop UI not built',
        detail: 'Run SETUP.bat or: npm run build',
        buttons: ['OK'],
      });
      app.quit();
      return;
    }

    const port = await startStaticServer(staticRoot);
    await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!IS_DEV) {
    const sidecarReady = await probeSidecar();
    if (!sidecarReady) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Conseal — Backend not running',
        message: 'Start the Python sidecar first',
        detail:
          'Open a terminal and run:\n\n' +
          '  python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000\n\n' +
          'Or double-click scripts\\1-start-backend.bat\n\n' +
          'The app will open anyway — use Retry in the UI once the backend is up.',
        buttons: ['Open Conseal'],
      });
    }
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopStaticServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopStaticServer();
});
