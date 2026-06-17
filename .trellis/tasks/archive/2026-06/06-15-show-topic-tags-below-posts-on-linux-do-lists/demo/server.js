// server.js - Minimal HTTPS server for the demo harness.
// Serves the Horizon-like HTML page under https://linux.do/ .
// Run via: node server.js

import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CERT_DIR = resolve(__dirname, 'certs')
const PORT = 8443

const cert = readFileSync(resolve(CERT_DIR, 'linux-do.crt'))
const key = readFileSync(resolve(CERT_DIR, 'linux-do.key'))

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf-8')

const server = createServer({ cert, key }, (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo HTTPS server listening on https://linux.do:${PORT}`)
  console.log('Waiting for Chromium (with --host-resolver-rules) to connect ...')
})
