import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SGL_ROOT = path.resolve(__dirname, '../SinGlutenLife/frontend')
const SGL_BASE = '/singluten/'

let sglServer

function mountSinGlutenLife() {
  return {
    name: 'mount-singluten-life',
    async configureServer(nexo) {
      if (!sglServer) {
        sglServer = await createServer({
          configFile: path.join(SGL_ROOT, 'vite.config.js'),
          root: SGL_ROOT,
          base: SGL_BASE,
          appType: 'spa',
          server: {
            middlewareMode: true,
            fs: { allow: [SGL_ROOT] },
            hmr: {
              server: nexo.httpServer,
            },
          },
        })
      }

      console.log('[nexo] SinGluten Life montada en http://127.0.0.1:5180/singluten/')

      nexo.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/singluten') {
          res.statusCode = 302
          res.setHeader('Location', SGL_BASE)
          res.end()
          return
        }
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
  }
}

export default defineConfig({
  plugins: [react(), mountSinGlutenLife()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    fs: {
      allow: [__dirname, SGL_ROOT],
    },
  },
})
