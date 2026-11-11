// How much the landing page downloads before it can run: the entry script, every chunk it imports
// statically (and theirs), and the stylesheets in index.html. Chunks loaded with import() are not counted.
// Usage: npm run build, then: node scripts/landing-weight.cjs [dist-folder]
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const dist = path.resolve(process.argv[2] || 'dist')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const gz = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length

const seen = new Set()
const queue = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
while (queue.length) {
  const url = queue.pop()
  const file = path.join(dist, url.replace(/^\//, ''))
  if (seen.has(file) || !fs.existsSync(file)) continue
  seen.add(file)
  const code = fs.readFileSync(file, 'utf8')
  // Static imports only: `import ... from "./x.js"` and `import "./x.js"`. A dynamic import is `import(`.
  for (const m of code.matchAll(/\bimport\s*(?:[^"'()]*?\bfrom\s*)?["'](\.[^"']+\.js)["']/g)) {
    queue.push('/' + path.relative(dist, path.resolve(path.dirname(file), m[1])))
  }
}

let script = 0
for (const file of seen) script += gz(file)
let style = 0
for (const url of styles) style += gz(path.join(dist, url.replace(/^\//, '')))
const names = [...seen].map((f) => path.basename(f)).sort()
console.log(JSON.stringify({ dist, scriptGzip: script, styleGzip: style, totalGzip: script + style, chunks: names }, null, 2))
