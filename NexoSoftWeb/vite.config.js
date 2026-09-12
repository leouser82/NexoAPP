import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { lookupPhoto, lookupPlace, peekPlace } from './placeInfo.js'
import { build as viteBuild, createServer, defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SGL_ROOT = path.resolve(__dirname, '../SinGlutenLife/frontend')
const SGL_BASE = '/singluten/'
const NEXO_MODULES = path.resolve(__dirname, 'node_modules')
const SGL_HTACCESS = `RewriteEngine On
RewriteBase /singluten/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /singluten/index.html [L]
`

let sglServer

function pkg(name) {
  return path.join(NEXO_MODULES, name)
}

function sglInlineConfig(extra = {}) {
  return {
    configFile: false,
    root: SGL_ROOT,
    base: SGL_BASE,
    appType: 'spa',
    plugins: [react()],
    resolve: {
      alias: {
        react: pkg('react'),
        'react-dom': pkg('react-dom'),
        'react-router-dom': pkg('react-router-dom'),
      },
    },
    ...extra,
  }
}

function redirectBareSingluten(req, res, next) {
  const url = req.url || ''
  if (url === '/singluten') {
    res.statusCode = 302
    res.setHeader('Location', SGL_BASE)
    res.end()
    return
  }
  next()
}

function sglPreviewSpaFallback(req, res, next) {
  const raw = (req.url || '').split('?')[0]
  if (!raw.startsWith(SGL_BASE)) return next()
  if (path.extname(raw)) return next()
  req.url = `${SGL_BASE}index.html`
  next()
}

function placeInfoEndpoint() {
  return {
    name: 'place-info-endpoint',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathName = (req.url || '').split('?')[0]
        const isInfo = pathName === '/place-info.php' || pathName === '/api/place-info'
        const isPhoto = pathName === '/api/place-photo'
        const isGf = pathName === '/api/place-gf'
        if (!isInfo && !isPhoto && !isGf) {
          return next()
        }
        const url = new URL(req.url, 'http://127.0.0.1')
        const query = {
          name: url.searchParams.get('name') || '',
          address: url.searchParams.get('address') || '',
          lat: url.searchParams.get('lat'),
          lon: url.searchParams.get('lon'),
          type: url.searchParams.get('type') || '',
          area: url.searchParams.get('area') || '',
          website: url.searchParams.get('website') || '',
        }
        try {
          let data
          if (isGf) data = peekPlace(query)
          else if (isPhoto) data = await lookupPhoto(query)
          else data = await lookupPlace(query)
          const payload = JSON.stringify(data)
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=180',
          })
          res.end(payload)
        } catch (error) {
          const payload = JSON.stringify({ ok: false, error: String(error.message || error) })
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(payload)
        }
      })
    },
  }
}

function briefingDevEndpoint() {
  return {
    name: 'briefing-dev-endpoint',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (req.method !== 'POST' || url !== '/send-briefing.php') {
          return next()
        }
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          const payload = JSON.stringify({ ok: true, dev: true })
          console.log('[briefing]', Buffer.concat(chunks).toString('utf8'))
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(payload),
          })
          res.end(payload)
        })
      })
    },
  }
}

function embedSinGlutenLife() {
  return {
    name: 'embed-singluten-life',
    async configureServer(nexo) {
      if (!sglServer) {
        sglServer = await createServer(
          sglInlineConfig({
            server: {
              middlewareMode: true,
              watch: { ignored: ['**/.cache/**'] },
              fs: { allow: [SGL_ROOT, __dirname] },
              hmr: {
                server: nexo.httpServer,
              },
            },
          }),
        )
      }

      console.log('[nexo] SinGluten Life montada en http://127.0.0.1:5180/singluten/')

      nexo.middlewares.use(redirectBareSingluten)
      nexo.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith(SGL_BASE)) {
          return next()
        }
        sglServer.middlewares(req, res, next)
      })

      nexo.httpServer?.once('close', async () => {
        if (!sglServer) return
        await sglServer.close()
        sglServer = undefined
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectBareSingluten)
      server.middlewares.use(sglPreviewSpaFallback)
    },
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, 'dist/singluten')
        await viteBuild(
          sglInlineConfig({
            build: {
              outDir,
              emptyOutDir: true,
            },
          }),
        )
        fs.writeFileSync(path.join(outDir, '.htaccess'), SGL_HTACCESS)
        console.log('[nexo] SinGluten Life compilada en dist/singluten/')
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), briefingDevEndpoint(), placeInfoEndpoint(), embedSinGlutenLife()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    // The scraper cache lives in the project folder; writing to it must not
    // reload the browser.
    watch: {
      ignored: ['**/.cache/**'],
    },
    fs: {
      allow: [__dirname, SGL_ROOT],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: false,
  },
})
