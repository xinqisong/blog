import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The custom GitHub Pages domain serves the uploaded dist directory at /.
const dist = process.argv[2]
  ? resolve(process.argv[2])
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', '.vitepress', 'dist')
const pages = ['index.html', join('ai', 'AgentScope.html'), join('java', 'Java网络编程-NIO.html'), join('java', 'Netty.html')]
const assets = [...new Set(pages.flatMap((page) => {
  const html = readFileSync(join(dist, page), 'utf8')
  return [...html.matchAll(/\b(?:src|href)="(\/[^"?#]+\.(?:js|css|woff2?|ico|png|svg))"/g)]
    .map((match) => match[1])
}))]

if (assets.length === 0) {
  throw new Error('No root-relative assets found in the built pages')
}

const missing = assets.filter((asset) => !existsSync(join(dist, decodeURIComponent(asset.slice(1)))))
if (missing.length > 0) {
  throw new Error(`Built pages reference assets missing from the domain root:\n${missing.join('\n')}`)
}

console.log(`Verified ${assets.length} root-relative assets in the GitHub Pages artifact.`)
