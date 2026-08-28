import fs from 'node:fs'
import { collides, withinCanvas } from '../src/editorGeometry.js'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const baseUrl = env.VITE_SUPABASE_URL
const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
const checkAllArtworkFiles = process.argv.includes('--all-assets')
if (!baseUrl || !publicKey) throw new Error('Supabase environment variables are missing.')

const response = await fetch(`${baseUrl}/rest/v1/compositions?select=*&order=created_at.desc`, {
  headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
})
if (!response.ok) throw new Error(`Could not load compositions (${response.status}).`)

const posts = await response.json()
const wave = JSON.parse(fs.readFileSync('public/artworks/data.json', 'utf8'))
const notes = JSON.parse(fs.readFileSync('public/artworks/notes/data.json', 'utf8'))
const artworkIds = new Set([...wave, ...notes].map((artwork) => Number(artwork.id)))
const artworkTitles = new Set([...wave, ...notes].map((artwork) => artwork.title))
const artworkById = new Map([...wave, ...notes].map((artwork) => [Number(artwork.id), artwork]))
const artworkByTitle = new Map([...wave, ...notes].map((artwork) => [artwork.title, artwork]))
const usedArtworks = new Map()
const issues = []

for (const post of posts) {
  const composition = post.composition
  if (composition?.format === 'leesahm-mapping' && composition.version === 1) {
    if (!composition.composition || !Array.isArray(composition.placements)) {
      issues.push(`${post.id}: mapping fields are missing`)
      continue
    }
    for (const placement of composition.placements) {
      if (!artworkTitles.has(placement.title)) issues.push(`${post.id}: artwork title is missing (${placement.title})`)
      else usedArtworks.set(placement.title, artworkByTitle.get(placement.title))
    }
    continue
  }

  if (composition?.format === 'leesahm-composition' && [1, 2, 3].includes(composition.version)) {
    if (!composition.canvas || !Array.isArray(composition.layers)) {
      issues.push(`${post.id}: legacy fields are missing`)
      continue
    }
    const layers = composition.layers.map((layer) => ({
      id: Number(layer.artworkId),
      x: Number(layer.x),
      y: Number(layer.y),
      width: Number(layer.width),
      ratio: Number(layer.ratio),
      rotation: Number(layer.rotation),
    }))
    if (layers.some((layer) => !artworkIds.has(layer.id))) issues.push(`${post.id}: artwork id is missing`)
    for (const layer of layers) {
      const artwork = artworkById.get(layer.id)
      if (artwork) usedArtworks.set(artwork.title, artwork)
    }
    if (layers.some((layer, index) => collides([layer], layers.slice(index + 1)))) issues.push(`${post.id}: artworks overlap`)
    if (!withinCanvas(layers, composition.canvas)) issues.push(`${post.id}: artwork is outside its canvas`)
    continue
  }

  issues.push(`${post.id}: unknown composition format`)
}

const thumbnailBase = `${baseUrl}/storage/v1/object/public/composition-thumbnails/`
const thumbnailResults = await Promise.all(posts.map(async (post) => {
  try {
    const thumbnail = await fetch(`${thumbnailBase}${post.thumbnail_path}`, { method: 'HEAD' })
    return thumbnail.ok && thumbnail.headers.get('content-type')?.startsWith('image/webp')
      ? null
      : `${post.id}: thumbnail returned ${thumbnail.status} ${thumbnail.headers.get('content-type') ?? ''}`.trim()
  } catch (error) {
    return `${post.id}: thumbnail request failed (${error.message})`
  }
}))
issues.push(...thumbnailResults.filter(Boolean))

const artworksToCheck = checkAllArtworkFiles ? [...wave, ...notes] : [...usedArtworks.values()]
const artworkFiles = [...new Set(artworksToCheck.flatMap((artwork) => [artwork.pickerUrl, artwork.pickerLargeUrl, artwork.previewUrl, artwork.originalUrl].filter(Boolean)))]
let nextArtworkFile = 0
const artworkResults = []
await Promise.all(Array.from({ length: Math.min(16, artworkFiles.length) }, async () => {
  while (nextArtworkFile < artworkFiles.length) {
    const path = artworkFiles[nextArtworkFile]
    nextArtworkFile += 1
    try {
      const asset = await fetch(`${new URL(path, 'https://leesahm.art')}`, { method: 'HEAD' })
      artworkResults.push(asset.ok && asset.headers.get('content-type')?.startsWith('image/')
        ? null
        : `${path}: artwork returned ${asset.status} ${asset.headers.get('content-type') ?? ''}`.trim())
    } catch (error) {
      artworkResults.push(`${path}: artwork request failed (${error.message})`)
    }
  }
}))
issues.push(...artworkResults.filter(Boolean))

console.log(JSON.stringify({
  posts: posts.length,
  owners: new Set(posts.map((post) => post.user_id)).size,
  formats: Object.fromEntries(Object.entries(Object.groupBy(posts, (post) => `${post.composition?.format}|${post.composition?.version}`)).map(([key, rows]) => [key, rows.length])),
  usedArtworks: usedArtworks.size,
  checkedArtworkFiles: artworkFiles.length,
  issues,
}, null, 2))
