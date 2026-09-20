import { collides, compositionFrame, placeByTopLeft, withinCanvas } from './editorGeometry.js'

export const MAX_CANVAS_SIZE = 5000
export const FIXED_ARTWORK_LONG_EDGE = 420
export const F50_LONG_EDGE_CM = 116.8
export const F50_SHORT_EDGE_CM = 91
export const CM_PER_PIXEL = F50_LONG_EDGE_CM / FIXED_ARTWORK_LONG_EDGE
export const WORKSPACE_PADDING = 120

export function loadImage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => { image.src = ''; reject(new Error('Image timeout')) }, timeoutMs)
    image.onload = () => { window.clearTimeout(timer); resolve(image) }
    image.onerror = () => { window.clearTimeout(timer); reject(new Error('Image error')) }
    image.src = url
  })
}

export function fitWorkspace(layers) {
  const frame = compositionFrame(layers)
  if (!frame) return { layers, canvasSize: { width: 1200, height: 900 } }
  return {
    layers: frame.layers.map((layer) => ({ ...layer, x: layer.x + WORKSPACE_PADDING, y: layer.y + WORKSPACE_PADDING })),
    canvasSize: { width: Math.max(1200, frame.width + WORKSPACE_PADDING * 2), height: Math.max(900, frame.height + WORKSPACE_PADDING * 2) },
  }
}

export async function restoreComposition(data, artworks, { allowOverlap = false } = {}) {
  if (data.format === 'leesahm-mapping' && data.version === 1) {
    const width = Number(data.composition?.width) / CM_PER_PIXEL
    const height = Number(data.composition?.height) / CM_PER_PIXEL
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || width > MAX_CANVAS_SIZE || height < 1 || height > MAX_CANVAS_SIZE || !Array.isArray(data.placements)) throw new Error('Invalid mapping')
    const artworkIds = new Set()
    const layers = await Promise.all(data.placements.map(async (saved) => {
      const artwork = artworks.find((item) => item.id === Number(saved.artworkId)) ?? artworks.find((item) => item.title === saved.title)
      const values = [saved.x, saved.y, saved.rotation].map(Number)
      if (!artwork || artworkIds.has(artwork.id) || values.some((value) => !Number.isFinite(value)) || values[0] < 0 || values[1] < 0 || values[2] % 90 !== 0) throw new Error('Invalid placement')
      artworkIds.add(artwork.id)
      const savedRatio = Number(saved.ratio)
      const ratio = Number.isFinite(savedRatio) && savedRatio > 0 ? savedRatio : await loadImage(artwork.previewUrl, 10000).then((image) => image.naturalHeight / image.naturalWidth)
      const layer = { ...artwork, x: 0, y: 0, width: FIXED_ARTWORK_LONG_EDGE / Math.max(1, ratio), ratio, rotation: values[2] }
      return placeByTopLeft(layer, values[0] / CM_PER_PIXEL, values[1] / CM_PER_PIXEL)
    }))
    if ((!allowOverlap && layers.some((layer, index) => collides([layer], layers.slice(index + 1)))) || !withinCanvas(layers, { width, height })) throw new Error('Invalid placement')
    return fitWorkspace(layers)
  }
  const width = Number(data.canvas?.width); const height = Number(data.canvas?.height)
  if (data.format !== 'leesahm-composition' || ![1, 2, 3].includes(data.version) || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || width > MAX_CANVAS_SIZE || height < 1 || height > MAX_CANVAS_SIZE || !Array.isArray(data.layers)) throw new Error('Invalid composition')
  const ids = new Set()
  const layers = data.layers.map((saved) => {
    const artwork = artworks.find((item) => item.id === Number(saved.artworkId))
    const values = [saved.x, saved.y, saved.width, saved.ratio, saved.rotation].map(Number)
    if (!artwork || ids.has(artwork.id) || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0 || values[2] > 10000 || values[4] % 90 !== 0) throw new Error('Invalid layer')
    ids.add(artwork.id)
    return { ...artwork, x: values[0], y: values[1], width: values[2], ratio: values[3], rotation: values[4] }
  })
  if (layers.some((layer, index) => collides([layer], layers.slice(index + 1))) || !withinCanvas(layers, { width, height })) throw new Error('Invalid placement')
  return fitWorkspace(layers)
}

