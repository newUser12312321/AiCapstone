import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const localCapturesDir = resolve(rootDir, '../edge/captures')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

/** dev: PC의 edge/captures 파일을 /captures 로 직접 서빙 (Pi 프록시 전) */
function localCapturesDevPlugin(): Plugin {
  return {
    name: 'local-captures-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/captures/')) return next()
        const name = decodeURIComponent(url.slice('/captures/'.length))
        if (!name || name.includes('..')) return next()
        const file = join(localCapturesDir, name)
        if (!file.startsWith(localCapturesDir)) return next()
        try {
          if (!existsSync(file) || !statSync(file).isFile()) return next()
          const ext = extname(file).toLowerCase()
          res.statusCode = 200
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          createReadStream(file).pipe(res)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const runtimeEdgeCaptureUrl = process.env.VITE_EDGE_CAPTURE_URL?.trim()
  const runtimeApiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim()
  const apiProxyTarget =
    runtimeApiProxyTarget || env.VITE_API_PROXY_TARGET?.trim() || 'http://localhost:8080'
  const edgeCaptureUrl =
    env.VITE_EDGE_CAPTURE_URL?.trim() ||
    runtimeEdgeCaptureUrl ||
    'http://127.0.0.1:8000'

  const devProxy = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
    },
    '/edge': {
      target: edgeCaptureUrl,
      changeOrigin: true,
    },
    '/captures': {
      target: edgeCaptureUrl,
      changeOrigin: true,
    },
    '/demo_samples': {
      target: edgeCaptureUrl,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), localCapturesDevPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: devProxy,
    },
    preview: {
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      proxy: devProxy,
    },
  }
})
