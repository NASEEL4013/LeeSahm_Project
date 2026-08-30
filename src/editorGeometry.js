const EPSILON = 0.5
const nearbyOffsetCache = new Map()

export const quarterTurn = (degrees) => Math.round(degrees / 90) * 90

export function corners(layer) {
  const width = layer.width
  const height = width * layer.ratio
  const centerX = layer.x + width / 2
  const centerY = layer.y + height / 2
  const angle = layer.rotation * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]
    .map(([x, y]) => ({ x: centerX + x * cos - y * sin, y: centerY + x * sin + y * cos }))
}

export function bounds(layer) {
  const points = corners(layer)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

export function overlaps(first, second) {
  const firstPoints = corners(first)
  const secondPoints = corners(second)
  const polygonAxes = (points) => points.map((point, index) => {
    const next = points[(index + 1) % 4]
    return { x: -(next.y - point.y), y: next.x - point.x }
  })
  const axes = [...polygonAxes(firstPoints), ...polygonAxes(secondPoints)]
  return axes.every((axis) => {
    const firstProjection = firstPoints.map((point) => point.x * axis.x + point.y * axis.y)
    const secondProjection = secondPoints.map((point) => point.x * axis.x + point.y * axis.y)
    const overlap = Math.min(Math.max(...firstProjection), Math.max(...secondProjection)) - Math.max(Math.min(...firstProjection), Math.min(...secondProjection))
    return overlap > EPSILON
  })
}

export function collides(moving, stationary) {
  return moving.some((layer) => stationary.some((other) => overlaps(layer, other)))
}

export function withinCanvas(layers, canvas) {
  return layers.every((layer) => {
    const box = bounds(layer)
    return box.left >= -EPSILON && box.top >= -EPSILON && box.right <= canvas.width + EPSILON && box.bottom <= canvas.height + EPSILON
  })
}

export function compositionFrame(layers) {
  if (!layers.length) return null
  const boxes = layers.map(bounds)
  const left = Math.floor(Math.min(...boxes.map((box) => box.left)))
  const top = Math.floor(Math.min(...boxes.map((box) => box.top)))
  const right = Math.ceil(Math.max(...boxes.map((box) => box.right)))
  const bottom = Math.ceil(Math.max(...boxes.map((box) => box.bottom)))
  return { left, top, width: right - left, height: bottom - top, layers: layers.map((layer) => ({ ...layer, x: layer.x - left, y: layer.y - top })) }
}

const roundToHundredth = (value) => Math.round(value * 100) / 100

export function physicalMapping(layers, centimetersPerPixel) {
  if (!layers.length) return null
  const boxes = layers.map(bounds)
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.right))
  const bottom = Math.max(...boxes.map((box) => box.bottom))
  return {
    width: roundToHundredth((right - left) * centimetersPerPixel),
    height: roundToHundredth((bottom - top) * centimetersPerPixel),
    placements: layers.map((layer, index) => {
      const box = boxes[index]
      return {
        artworkId: layer.id,
        title: layer.title,
        ratio: layer.ratio,
        x: roundToHundredth((box.left - left) * centimetersPerPixel),
        y: roundToHundredth((box.top - top) * centimetersPerPixel),
        rotation: ((layer.rotation % 360) + 360) % 360,
      }
    }),
  }
}

export function placeByTopLeft(layer, left, top) {
  const box = bounds({ ...layer, x: 0, y: 0 })
  return { ...layer, x: left - box.left, y: top - box.top }
}

export function exportScale(frame, sourceScales, maxEdge = 16384) {
  return Math.min(Math.max(...sourceScales), maxEdge / frame.width, maxEdge / frame.height)
}

export function boundedExportScale(frame, sourceScales, maxEdge, maxPixels) {
  return Math.min(exportScale(frame, sourceScales, maxEdge), Math.sqrt(maxPixels / (frame.width * frame.height)))
}

export function scaleLayers(layers, anchor, factor) {
  return layers.map((layer) => {
    const width = layer.width * factor
    const centerX = anchor.x + (layer.x + layer.width / 2 - anchor.x) * factor
    const centerY = anchor.y + (layer.y + layer.width * layer.ratio / 2 - anchor.y) * factor
    return { ...layer, width, x: centerX - width / 2, y: centerY - width * layer.ratio / 2 }
  })
}

export function findOpenPosition(layer, layers, canvas, step = 20) {
  const height = layer.width * layer.ratio
  const maxX = canvas.width - layer.width
  const maxY = canvas.height - height
  if (maxX < 0 || maxY < 0) return null
  const positions = (maximum, edges) => [...new Set([
    0, maximum,
    ...Array.from({ length: Math.floor(maximum / step) }, (_, index) => (index + 1) * step),
    ...edges,
  ].filter((value) => value >= 0 && value <= maximum))].sort((a, b) => a - b)
  const boxes = layers.map(bounds)
  const xs = positions(maxX, boxes.flatMap((box) => [box.left - layer.width, box.right]))
  const ys = positions(maxY, boxes.flatMap((box) => [box.top - height, box.bottom]))
  // ponytail: a grid and artwork-edge scan is enough here; add a spatial index only if adding a work becomes measurably slow.
  for (const y of ys) {
    for (const x of xs) {
      const candidate = { ...layer, x, y }
      if (!collides([candidate], layers)) return { x, y }
    }
  }
  return null
}

export function findLargestOpenPlacement(layer, layers, canvas, minimumWidth = 40, step = 20) {
  const maximum = Math.min(layer.width, canvas.width, canvas.height / layer.ratio)
  const minimum = Math.min(minimumWidth, maximum)
  const widths = []
  for (let width = maximum; width > minimum; width -= step) widths.push(width)
  widths.push(minimum)
  for (const width of widths) {
    const candidate = { ...layer, width }
    const position = findOpenPosition(candidate, layers, canvas, step)
    if (position) return { ...candidate, ...position }
  }
  return null
}

export function findNearbyOpenPlacement(layer, layers, step = 20, maxDistance = 1000) {
  if (!collides([layer], layers)) return layer
  const cacheKey = `${step}:${maxDistance}`
  let offsets = nearbyOffsetCache.get(cacheKey)
  if (!offsets) {
    offsets = []
    for (let x = -maxDistance; x <= maxDistance; x += step) {
      for (let y = -maxDistance; y <= maxDistance; y += step) offsets.push({ x, y })
    }
    offsets.sort((first, second) => Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y))
    nearbyOffsetCache.set(cacheKey, offsets)
  }
  for (const offset of offsets) {
    const candidate = { ...layer, x: layer.x + offset.x, y: layer.y + offset.y }
    if (!collides([candidate], layers)) return candidate
  }
  return null
}
