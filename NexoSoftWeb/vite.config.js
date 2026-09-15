import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { communityMiddleware } from '../SinGlutenLife/frontend/communityDev.js'
import { lookupPhoto, lookupPlace } from './placeInfo.js'
import { celimapRaw } from './scraper/gfGuides.js'
import { lookupReviews } from './scraper/googleReviews.js'
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
    plugins: [
      react(),
      {
        name: 'community-recipes-endpoint',
        configureServer(server) {
          server.middlewares.use(communityMiddleware())
        },
      },
    ],
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

function sglApiPath(raw) {
  const pathName = (raw || '').split('?')[0]
  return pathName.startsWith(SGL_BASE) ? pathName.slice(SGL_BASE.length - 1) : pathName
}

function syncSglPhp() {
  const names = ['gf-guides.php', 'place-reviews.php', 'place-info.php', 'community-recipes.php']
  for (const name of names) {
    const from = path.join(SGL_ROOT, 'public', name)
    const to = path.join(__dirname, 'public', name)
    if (fs.existsSync(from)) fs.copyFileSync(from, to)
  }
}

function communityRecipesEndpoint() {
  return {
    name: 'community-recipes-endpoint',
    configureServer(server) {
      server.middlewares.use(communityMiddleware())
    },
  }
}

function placeInfoEndpoint() {
  return {
    name: 'place-info-endpoint',
    configureServer(server) {
      syncSglPhp()
      server.middlewares.use(async (req, res, next) => {
        const pathName = sglApiPath(req.url || '')
        const isInfo = pathName === '/place-info.php' || pathName === '/api/place-info'
        const isPhoto = pathName === '/api/place-photo'
        const isGuides = pathName === '/gf-guides.php'
        const isReviews = pathName === '/place-reviews.php' || pathName === '/api/place-reviews'
        if (!isInfo && !isPhoto && !isGuides && !isReviews) {
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
          id: url.searchParams.get('id') || '',
          guideUrl: url.searchParams.get('guideUrl') || '',
          googlePlaceId: url.searchParams.get('googlePlaceId') || '',
        }
        try {
          let data
          if (isGuides) data = await celimapRaw()
          else if (isReviews) data = await lookupReviews(query)
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
        syncSglPhp()
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
  plugins: [react(), briefingDevEndpoint(), communityRecipesEndpoint(), placeInfoEndpoint(), embedSinGlutenLife()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    // The scraper cache lives in the project folder; writing to it must not
    // reload the browser.
    watch: {
      ignored: ['**/.cache/**', '**/data/community-recipes.json'],
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
