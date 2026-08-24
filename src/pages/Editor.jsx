import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bounds, collides, compositionFrame, findLargestOpenPlacement, findNearbyOpenPlacement, quarterTurn, scaleLayers, withinCanvas } from '../editorGeometry.js'
import { useAuth } from '../AuthContext.jsx'
import { isSupabaseReady, supabase } from '../supabase.js'

const SNAP_PX = 10
const BACKGROUND = '#a9a59d'
const DRAFT_KEY = 'leesahm-compose-draft'
const MAX_CANVAS_SIZE = 5000
const FIXED_ARTWORK_LONG_EDGE = 420
const WORKSPACE_PADDING = 120
const PICKER_PAGE_SIZE = 30
const MODES = {
  free: { label: '자유 조합', limit: Infinity },
  500: { label: '500호 · 10점', limit: 10 },
  1000: { label: '1000호 · 20점', limit: 20 },
}
const COLOR_FILTERS = [
  ['all', '전체', '#d8d3c9'], ['red', '빨강·주황', '#b7442f'], ['yellow', '노랑·베이지', '#d4a43f'],
  ['green', '초록', '#557b5a'], ['blue', '파랑·남색', '#385b83'], ['purple', '보라·분홍', '#885d80'], ['neutral', '흑백·회색', '#77736d'],
]

function loadImage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => { image.src = ''; reject(new Error('Image timeout')) }, timeoutMs)
    image.onload = () => { window.clearTimeout(timer); resolve(image) }
    image.onerror = () => { window.clearTimeout(timer); reject(new Error('Image error')) }
    image.src = url
  })
}

function sourceCrop(image, ratio) {
  const sourceRatio = image.naturalWidth / image.naturalHeight
  if (sourceRatio > 1 / ratio) {
    const width = image.naturalHeight / ratio
    return [(image.naturalWidth - width) / 2, 0, width, image.naturalHeight]
  }
  const height = image.naturalWidth * ratio
  return [0, (image.naturalHeight - height) / 2, image.naturalWidth, height]
}

function fitWorkspace(layers) {
  const frame = compositionFrame(layers)
  if (!frame) return { layers, canvasSize: { width: 1200, height: 900 } }
  return {
    layers: frame.layers.map((layer) => ({ ...layer, x: layer.x + WORKSPACE_PADDING, y: layer.y + WORKSPACE_PADDING })),
    canvasSize: { width: Math.max(1200, frame.width + WORKSPACE_PADDING * 2), height: Math.max(900, frame.height + WORKSPACE_PADDING * 2) },
  }
}

function readDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY))
    const workspaceSize = draft?.workspaceSize ?? draft?.canvasSize
    return Array.isArray(draft?.layers) && Number.isFinite(workspaceSize?.width) && Number.isFinite(workspaceSize?.height) ? { ...draft, workspaceSize } : null
  } catch { return null }
}

export default function Editor() {
  const navigate = useNavigate(); const { user } = useAuth(); const initialDraft = useRef(readDraft()).current
  const [artworks, setArtworks] = useState([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [colorFilter, setColorFilter] = useState('all')
  const [pickerLimit, setPickerLimit] = useState(PICKER_PAGE_SIZE)
  const [layers, setLayers] = useState(initialDraft?.layers ?? [])
  const [active, setActive] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [canvasSize, setCanvasSize] = useState(initialDraft?.workspaceSize ?? { width: 1200, height: 900 })
  const [mode, setMode] = useState(initialDraft?.mode && MODES[initialDraft.mode] ? initialDraft.mode : 'free')
  const [postTitle, setPostTitle] = useState(initialDraft?.postTitle ?? '')
  const [postDescription, setPostDescription] = useState(initialDraft?.postDescription ?? '')
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')
  const [guides, setGuides] = useState({ x: null, y: null })
  const stageRef = useRef(null)
  const actionRef = useRef(null)
  const loadingIdsRef = useRef(new Set())
  const fileInputRef = useRef(null)

  useEffect(() => { fetch('/artworks/data.json').then((res) => res.json()).then(setArtworks).catch(() => setMessage('작품 목록을 불러오지 못했습니다.')) }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify({ layers, workspaceSize: canvasSize, mode, postTitle, postDescription })), 400)
    return () => window.clearTimeout(timer)
  }, [layers, canvasSize, mode, postTitle, postDescription])
  useEffect(() => {
    if (!message || message.endsWith('...')) return undefined
    const timer = window.setTimeout(() => setMessage(''), 3000)
    return () => window.clearTimeout(timer)
  }, [message])
  const fixedSize = mode !== 'free'
  const activeLayer = layers.find((layer) => layer.id === active)
  const exportFrame = useMemo(() => compositionFrame(layers), [layers])
  const selectionBounds = useMemo(() => {
    const selected = layers.filter((layer) => selectedIds.includes(layer.id))
    if (selected.length < 2) return null
    const selectedBounds = selected.map(bounds)
    const left = Math.min(...selectedBounds.map((item) => item.left)); const top = Math.min(...selectedBounds.map((item) => item.top))
    const right = Math.max(...selectedBounds.map((item) => item.right)); const bottom = Math.max(...selectedBounds.map((item) => item.bottom))
    return { left, top, width: right - left, height: bottom - top }
  }, [layers, selectedIds])
  const filteredArtworks = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase()
    const numberQuery = query.replace(/\D/g, '')
    return artworks.filter((art) => (colorFilter === 'all' || art.colors?.includes(colorFilter)) && (!query || art.title.toLowerCase().includes(query) || (numberQuery && art.title.replace(/\D/g, '').includes(numberQuery))))
  }, [artworks, pickerQuery, colorFilter])
  const visibleArtworks = filteredArtworks.slice(0, pickerLimit)
  useEffect(() => { setPickerLimit(PICKER_PAGE_SIZE) }, [pickerQuery, colorFilter])

  async function addLayer(art) {
    if (layers.some((layer) => layer.id === art.id)) { setActive(art.id); setSelectedIds([art.id]); return }
    if (loadingIdsRef.current.has(art.id)) return
    if (layers.length >= MODES[mode].limit) return setMessage(`${MODES[mode].label} 모드는 작품을 ${MODES[mode].limit}개까지 배치할 수 있어요.`)
    loadingIdsRef.current.add(art.id)
    try {
      const image = await loadImage(art.previewUrl, 10000)
      const ratio = image.naturalHeight / image.naturalWidth
      const width = FIXED_ARTWORK_LONG_EDGE / Math.max(1, ratio)
      const next = findLargestOpenPlacement({ ...art, x: 0, y: 0, width, ratio, rotation: 0 }, layers, { width: MAX_CANVAS_SIZE, height: MAX_CANVAS_SIZE }, fixedSize ? width : 40)
      if (fixedSize && next?.width !== width) return setMessage('50호 실제 크기로 넣을 빈 공간이 없어요. 캔버스를 넓혀주세요.')
      if (!next) return setMessage('작품을 넣을 수 있는 빈 공간이 없어요.')
      const fitted = fitWorkspace([...layers, next])
      setLayers(fitted.layers); setCanvasSize(fitted.canvasSize); setActive(art.id); setSelectedIds([art.id]); setMessage('')
    } catch { setMessage('작품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.') }
    finally { loadingIdsRef.current.delete(art.id) }
  }

  function beginAction(event, type, layer, corner = null) {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    let movingIds = [layer.id]
    if (type === 'move' && event.shiftKey) {
      movingIds = selectedIds.includes(layer.id) ? selectedIds.filter((id) => id !== layer.id) : [...selectedIds, layer.id]
      setSelectedIds(movingIds); setActive(movingIds.includes(layer.id) ? layer.id : movingIds.at(-1) ?? null)
      if (!movingIds.includes(layer.id)) return
    } else if (type === 'move' && selectedIds.includes(layer.id)) {
      movingIds = selectedIds
      setActive(layer.id)
    } else {
      setSelectedIds([layer.id]); setActive(layer.id)
    }
    const rect = stageRef.current.getBoundingClientRect(); const scale = rect.width / canvasSize.width
    const centerX = rect.left + (layer.x + layer.width / 2) * scale
    const centerY = rect.top + (layer.y + layer.width * layer.ratio / 2) * scale
    const signs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] }[corner]
    let anchor = null
    if (signs) {
      const angle = layer.rotation * Math.PI / 180
      const dx = -signs[0] * layer.width / 2; const dy = -signs[1] * layer.width * layer.ratio / 2
      anchor = { x: layer.x + layer.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), y: layer.y + layer.width * layer.ratio / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) }
    }
    const startPositions = Object.fromEntries(layers.filter((item) => movingIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }]))
    actionRef.current = { type, id: layer.id, movingIds, startPositions, corner, signs, anchor, startX: event.clientX, startY: event.clientY, x: layer.x, y: layer.y, width: layer.width, rotation: layer.rotation, centerX, centerY, startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) }
  }

  function beginGroupResize(event, corner) {
    if (fixedSize) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    const signs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] }[corner]
    const anchor = {
      x: signs[0] > 0 ? selectionBounds.left : selectionBounds.left + selectionBounds.width,
      y: signs[1] > 0 ? selectionBounds.top : selectionBounds.top + selectionBounds.height,
    }
    actionRef.current = { type: 'group-resize', selectedIds: [...selectedIds], startLayers: layers.filter((layer) => selectedIds.includes(layer.id)), startBounds: selectionBounds, anchor }
  }

  function snapDelta(action, deltaX, deltaY, scale) {
    const moving = layers.filter((layer) => action.movingIds.includes(layer.id))
    const stationary = layers.filter((layer) => !action.movingIds.includes(layer.id))
    if (!moving.length) return { deltaX, deltaY, guideX: null, guideY: null }
    const moved = moving.map((layer) => ({ ...layer, x: action.startPositions[layer.id].x + deltaX, y: action.startPositions[layer.id].y + deltaY }))
    const movedBounds = moved.map(bounds)
    const left = Math.min(...movedBounds.map((box) => box.left)); const top = Math.min(...movedBounds.map((box) => box.top))
    const right = Math.max(...movedBounds.map((box) => box.right)); const bottom = Math.max(...movedBounds.map((box) => box.bottom))
    const threshold = SNAP_PX / scale; let bestX = null; let bestY = null
    const targets = stationary.map(bounds)
    for (const target of targets) {
      for (const [movingEdge, fixedEdge] of [[left, target.left], [left, target.right], [right, target.left], [right, target.right]]) {
        const distance = fixedEdge - movingEdge
        if (Math.abs(distance) <= threshold && (!bestX || Math.abs(distance) < Math.abs(bestX.distance))) bestX = { distance, guide: fixedEdge }
      }
      for (const [movingEdge, fixedEdge] of [[top, target.top], [top, target.bottom], [bottom, target.top], [bottom, target.bottom]]) {
        const distance = fixedEdge - movingEdge
        if (Math.abs(distance) <= threshold && (!bestY || Math.abs(distance) < Math.abs(bestY.distance))) bestY = { distance, guide: fixedEdge }
      }
    }
    let snappedX = deltaX + (bestX?.distance ?? 0); let snappedY = deltaY + (bestY?.distance ?? 0)
    return { deltaX: snappedX, deltaY: snappedY, guideX: bestX?.guide ?? null, guideY: bestY?.guide ?? null }
  }

  function resizedLayer(layer, action, width) {
    const height = width * layer.ratio; const angle = layer.rotation * Math.PI / 180
    const centerDx = action.signs[0] * width / 2; const centerDy = action.signs[1] * height / 2
    const centerX = action.anchor.x + centerDx * Math.cos(angle) - centerDy * Math.sin(angle)
    const centerY = action.anchor.y + centerDx * Math.sin(angle) + centerDy * Math.cos(angle)
    return { ...layer, width, x: centerX - width / 2, y: centerY - height / 2 }
  }

  function snapResize(layer, action, rawWidth, scale, stationary) {
    const threshold = SNAP_PX / scale
    const raw = resizedLayer(layer, action, rawWidth)
    const rawBounds = bounds(raw)
    const nextBounds = bounds(resizedLayer(layer, action, rawWidth + 1))
    const candidates = []
    for (const other of stationary) {
      candidates.push(other.width, other.width * other.ratio / layer.ratio)
    }
    const targetBounds = stationary.map(bounds)
    for (const otherBounds of targetBounds) {
      for (const edge of ['left', 'right', 'top', 'bottom']) {
        const slope = nextBounds[edge] - rawBounds[edge]
        if (Math.abs(slope) < 0.001) continue
        for (const target of edge === 'left' || edge === 'right' ? [otherBounds.left, otherBounds.right] : [otherBounds.top, otherBounds.bottom]) {
          if (Math.abs(target - rawBounds[edge]) <= threshold) candidates.push(rawWidth + (target - rawBounds[edge]) / slope)
        }
      }
    }
    const snappedWidth = candidates
      .filter((width) => width >= 100 && width <= 1100 && Math.abs(width - rawWidth) <= threshold)
      .sort((first, second) => Math.abs(first - rawWidth) - Math.abs(second - rawWidth))[0]
    return snappedWidth ? resizedLayer(layer, action, snappedWidth) : raw
  }

  function handlePointerMove(event) {
    const action = actionRef.current
    if (!action || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect(); const scale = rect.width / canvasSize.width
    if (action.type === 'group-resize' && !fixedSize) {
      const pointerX = (event.clientX - rect.left) / scale; const pointerY = (event.clientY - rect.top) / scale
      const factorX = Math.abs(pointerX - action.anchor.x) / action.startBounds.width
      const factorY = Math.abs(pointerY - action.anchor.y) / action.startBounds.height
      const minimum = Math.max(...action.startLayers.map((item) => 60 / item.width))
      const factor = Math.min(4, Math.max(minimum, Math.max(factorX, factorY)))
      const candidates = scaleLayers(action.startLayers, action.anchor, factor)
      setLayers((current) => {
        const stationary = current.filter((item) => !action.selectedIds.includes(item.id))
        if (collides(candidates, stationary)) return current
        return current.map((item) => candidates.find((candidate) => candidate.id === item.id) ?? item)
      })
      return
    }
    const layer = layers.find((item) => item.id === action.id)
    if (!layer) return
    if (action.type === 'move') {
      const deltaX = (event.clientX - action.startX) / scale; const deltaY = (event.clientY - action.startY) / scale
      const snapped = snapDelta(action, deltaX, deltaY, scale)
      setLayers((current) => {
        const stationary = current.filter((item) => !action.movingIds.includes(item.id))
        const desired = current.filter((item) => action.movingIds.includes(item.id)).map((item) => ({ ...item, x: action.startPositions[item.id].x + snapped.deltaX, y: action.startPositions[item.id].y + snapped.deltaY }))
        if (!collides(desired, stationary)) return current.map((item) => desired.find((moved) => moved.id === item.id) ?? item)
        const xOnly = desired.map((item) => ({ ...item, y: current.find((old) => old.id === item.id).y }))
        const yOnly = desired.map((item) => ({ ...item, x: current.find((old) => old.id === item.id).x }))
        const allowed = !collides(xOnly, stationary) ? xOnly : !collides(yOnly, stationary) ? yOnly : null
        return allowed ? current.map((item) => allowed.find((moved) => moved.id === item.id) ?? item) : current
      })
      setGuides({ x: snapped.guideX, y: snapped.guideY })
    }
    if (action.type === 'resize' && !fixedSize) {
      const pointerX = (event.clientX - rect.left) / scale; const pointerY = (event.clientY - rect.top) / scale
      const angle = -layer.rotation * Math.PI / 180; const dx = pointerX - action.anchor.x; const dy = pointerY - action.anchor.y
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle); const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
      const width = Math.min(1100, Math.max(100, Math.max(Math.abs(localX), Math.abs(localY) / layer.ratio)))
      setLayers((current) => {
        const stationary = current.filter((item) => item.id !== action.id)
        const candidate = snapResize(layer, action, width, scale, stationary)
        if (collides([candidate], stationary)) return current
        return current.map((item) => item.id === action.id ? candidate : item)
      })
    }
    if (action.type === 'rotate') {
      const angle = Math.atan2(event.clientY - action.centerY, event.clientX - action.centerX)
      const rotation = quarterTurn(action.rotation + (angle - action.startAngle) * 180 / Math.PI)
      const candidate = { ...layer, rotation }
      const stationary = layers.filter((item) => item.id !== action.id)
      const placement = findNearbyOpenPlacement(candidate, stationary)
      if (!placement) {
        setMessage('회전할 공간이 부족해요. 작품 사이를 조금 더 벌려주세요.')
        return
      }
      if (rotation !== layer.rotation) {
        const fitted = fitWorkspace(layers.map((item) => item.id === action.id ? placement : item))
        setLayers(fitted.layers); setCanvasSize(fitted.canvasSize)
      }
    }
  }

  function endAction() {
    if (actionRef.current && layers.length) {
      const fitted = fitWorkspace(layers)
      setLayers(fitted.layers); setCanvasSize(fitted.canvasSize)
    }
    actionRef.current = null; setGuides({ x: null, y: null })
  }

  function changeMode(nextMode) {
    if (layers.length) return setMessage('조합 모드는 빈 캔버스에서 선택해주세요.')
    setMode(nextMode); setMessage('')
  }

  function compositionData() {
    const frame = compositionFrame(layers)
    return {
      format: 'leesahm-composition', version: 2, mode, createdAt: new Date().toISOString(),
      canvas: { width: frame.width, height: frame.height, background: BACKGROUND },
      layers: frame.layers.map((layer) => ({ artworkId: layer.id, title: layer.title, x: layer.x, y: layer.y, width: layer.width, ratio: layer.ratio, rotation: layer.rotation })),
    }
  }

  function saveComposition() {
    if (!layers.length) return setMessage('먼저 작품을 하나 이상 추가해주세요.')
    const data = compositionData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.download = `leesahm-composition-${Date.now()}.json`; link.href = url; link.click(); URL.revokeObjectURL(url)
    setMessage('조합 파일을 저장했어요.')
  }

  async function importComposition(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const width = Number(data.canvas?.width); const height = Number(data.canvas?.height)
      if (data.format !== 'leesahm-composition' || ![1, 2].includes(data.version) || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || width > MAX_CANVAS_SIZE || height < 1 || height > MAX_CANVAS_SIZE || !Array.isArray(data.layers)) throw new Error('Invalid composition')
      const restoredMode = data.version === 2 && MODES[data.mode] ? data.mode : 'free'
      if (data.layers.length > MODES[restoredMode].limit) throw new Error('Invalid composition')
      const ids = new Set()
      const restored = data.layers.map((saved) => {
        const artwork = artworks.find((item) => item.id === Number(saved.artworkId))
        const values = [saved.x, saved.y, saved.width, saved.ratio, saved.rotation].map(Number)
        if (!artwork || ids.has(artwork.id) || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0 || values[2] > 10000 || values[4] % 90 !== 0) throw new Error('Invalid layer')
        ids.add(artwork.id)
        return { ...artwork, x: values[0], y: values[1], width: values[2], ratio: values[3], rotation: values[4] }
      })
      if (restored.some((layer, index) => collides([layer], restored.slice(index + 1))) || !withinCanvas(restored, { width, height })) throw new Error('Invalid placement')
      if (restoredMode !== 'free' && restored.some((layer) => Math.abs(Math.max(layer.width, layer.width * layer.ratio) - FIXED_ARTWORK_LONG_EDGE) > 1)) throw new Error('Invalid fixed size')
      const fitted = fitWorkspace(restored)
      setMode(restoredMode); setCanvasSize(fitted.canvasSize); setLayers(fitted.layers); setActive(null); setSelectedIds([]); setMessage('조합을 그대로 불러왔어요.')
    } catch { setMessage('올바른 LeeSahm 조합 파일이 아니거나 작품이 겹쳐 있어요.') }
    finally { event.target.value = '' }
  }

  async function downloadBlueprint() {
    if (!layers.length) return setMessage('먼저 작품을 하나 이상 추가해주세요.')
    setMessage('조합 설계도를 만드는 중...')
    try {
      const frame = compositionFrame(layers)
      const padding = 60; const legendWidth = 520; const mapScale = Math.min(900 / frame.width, 900 / frame.height)
      const mapWidth = frame.width * mapScale; const mapHeight = frame.height * mapScale; const lineHeight = 62
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(mapWidth + legendWidth + padding * 3); canvas.height = Math.ceil(Math.max(mapHeight + 180, layers.length * lineHeight + 180))
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#191816'; ctx.font = 'bold 30px Arial'; ctx.fillText('LeeSahm Composition Blueprint', padding, 48)
      ctx.font = '16px Arial'; ctx.fillStyle = '#676159'; ctx.fillText(`Canvas ${frame.width} × ${frame.height}px · Origin (0, 0) = top left`, padding, 76)
      const mapX = padding; const mapY = 110
      ctx.fillStyle = BACKGROUND; ctx.fillRect(mapX, mapY, mapWidth, mapHeight)
      ctx.strokeStyle = 'rgba(50,45,40,.18)'; ctx.lineWidth = 1
      for (let index = 1; index < 10; index += 1) {
        const x = mapX + mapWidth * index / 10; const y = mapY + mapHeight * index / 10
        ctx.beginPath(); ctx.moveTo(x, mapY); ctx.lineTo(x, mapY + mapHeight); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(mapX, y); ctx.lineTo(mapX + mapWidth, y); ctx.stroke()
      }
      const images = await Promise.all(layers.map((layer) => loadImage(layer.previewUrl, 10000)))
      frame.layers.forEach((layer, index) => {
        const height = layer.width * layer.ratio; const centerX = mapX + (layer.x + layer.width / 2) * mapScale; const centerY = mapY + (layer.y + height / 2) * mapScale
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(layer.rotation * Math.PI / 180)
        ctx.drawImage(images[index], -layer.width * mapScale / 2, -height * mapScale / 2, layer.width * mapScale, height * mapScale)
        ctx.strokeStyle = '#b33b28'; ctx.lineWidth = 3; ctx.strokeRect(-layer.width * mapScale / 2, -height * mapScale / 2, layer.width * mapScale, height * mapScale); ctx.restore()
        ctx.fillStyle = '#b33b28'; ctx.beginPath(); ctx.arc(centerX, centerY, 14, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(index + 1), centerX, centerY)
      })
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; const legendX = mapX + mapWidth + padding
      ctx.fillStyle = '#191816'; ctx.font = 'bold 20px Arial'; ctx.fillText('Artwork placement', legendX, 116)
      frame.layers.forEach((layer, index) => {
        const y = 155 + index * lineHeight; const topLeft = bounds(layer)
        ctx.fillStyle = '#b33b28'; ctx.font = 'bold 17px Arial'; ctx.fillText(`${index + 1}. ${layer.title}`, legendX, y)
        ctx.fillStyle = '#514d47'; ctx.font = '15px Arial'; ctx.fillText(`Top left ${Math.round(topLeft.left)}, ${Math.round(topLeft.top)} · Size ${Math.round(layer.width)} × ${Math.round(layer.width * layer.ratio)} · Rotate ${layer.rotation}°`, legendX, y + 25)
      })
      const link = document.createElement('a'); link.download = `leesahm-blueprint-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click(); setMessage('조합 설계도를 저장했어요.')
    } catch { setMessage('조합 설계도를 만들지 못했습니다. 잠시 후 다시 시도해주세요.') }
  }

  async function download() {
    if (!layers.length) return setMessage('먼저 작품을 하나 이상 추가해주세요.')
    setMessage('고해상도 이미지를 만드는 중...')
    try {
      const frame = compositionFrame(layers)
      const canvas = document.createElement('canvas'); canvas.width = frame.width; canvas.height = frame.height
      const ctx = canvas.getContext('2d'); ctx.fillStyle = BACKGROUND; ctx.fillRect(0, 0, canvas.width, canvas.height)
      let fallbackCount = 0
      for (const layer of frame.layers) {
        let img
        try { img = await loadImage(layer.originalUrl, 3000) } catch { img = await loadImage(layer.previewUrl, 10000); fallbackCount += 1 }
        const height = layer.width * layer.ratio
        ctx.save(); ctx.translate(layer.x + layer.width / 2, layer.y + height / 2); ctx.rotate(layer.rotation * Math.PI / 180)
        ctx.drawImage(img, ...sourceCrop(img, layer.ratio), -layer.width / 2, -height / 2, layer.width, height); ctx.restore()
      }
      const link = document.createElement('a'); link.download = `leesahm-composition-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click()
      setMessage(fallbackCount ? `다운로드 완료 · 원본이 없는 작품 ${fallbackCount}개는 고화질 미리보기를 사용했어요.` : '다운로드가 완료됐어요.')
    } catch { setMessage('이미지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.') }
  }

  async function makeThumbnail() {
    const frame = compositionFrame(layers)
    const scale = Math.min(900 / frame.width, 720 / frame.height)
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(frame.width * scale)); canvas.height = Math.max(1, Math.round(frame.height * scale))
    const ctx = canvas.getContext('2d'); ctx.fillStyle = BACKGROUND; ctx.fillRect(0, 0, canvas.width, canvas.height)
    const images = await Promise.all(frame.layers.map((layer) => loadImage(layer.previewUrl, 10000)))
    frame.layers.forEach((layer, index) => {
      const width = layer.width * scale; const height = layer.width * layer.ratio * scale
      ctx.save(); ctx.translate((layer.x + layer.width / 2) * scale, (layer.y + layer.width * layer.ratio / 2) * scale); ctx.rotate(layer.rotation * Math.PI / 180)
      ctx.drawImage(images[index], -width / 2, -height / 2, width, height); ctx.restore()
    })
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Thumbnail error')), 'image/webp', .88))
  }

  async function publishComposition() {
    if (!layers.length) return setMessage('먼저 작품을 하나 이상 추가해주세요.')
    if (!postTitle.trim() || !postDescription.trim()) return setMessage('게시할 작품의 제목과 설명을 입력해주세요.')
    if (!isSupabaseReady) return setMessage('게시판 저장소 연결이 아직 필요해요.')
    if (!user) { localStorage.setItem(DRAFT_KEY, JSON.stringify({ layers, workspaceSize: canvasSize, mode, postTitle, postDescription })); navigate('/login'); return }
    setPublishing(true); setMessage('게시용 이미지를 만드는 중...')
    const path = `${user.id}/${crypto.randomUUID()}.webp`
    try {
      const thumbnail = await makeThumbnail()
      const { error: uploadError } = await supabase.storage.from('composition-thumbnails').upload(path, thumbnail, { contentType: 'image/webp' })
      if (uploadError) throw uploadError
      const { data, error: insertError } = await supabase.from('compositions').insert({
        user_id: user.id, author_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Anonymous',
        title: postTitle.trim(), description: postDescription.trim(), composition: compositionData(), thumbnail_path: path,
      }).select('id').single()
      if (insertError) { await supabase.storage.from('composition-thumbnails').remove([path]); throw insertError }
      localStorage.removeItem(DRAFT_KEY); navigate(`/board/${data.id}`)
    } catch { setMessage('게시하지 못했어. 저장소 설정을 확인해줘.') }
    finally { setPublishing(false) }
  }

  return (
    <div className="compose-page" onPointerMove={handlePointerMove} onPointerUp={endAction} onPointerCancel={endAction}>
      <header className="compose-header"><div><p className="eyebrow">Interactive studio</p><h1>Compose</h1></div><p>작품을 변형하지 않고, 위치와 크기만 조절해 새로운 관계를 만들어보세요.</p></header>
      <div className="studio">
        <aside className="art-picker"><div className="panel-title"><span>작품 선택</span><span>{layers.length}개</span></div><label className="picker-search"><span className="sr-only">작품 검색</span><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="작품 번호 검색" /></label><div className="color-filters">{COLOR_FILTERS.map(([value, label, color]) => <button key={value} className={colorFilter === value ? 'selected' : ''} aria-pressed={colorFilter === value} onClick={() => setColorFilter(value)}><i aria-hidden="true" style={{ backgroundColor: color }} />{label}</button>)}</div><div className="picker-grid">{visibleArtworks.map((art) => <button key={art.id} className={layers.some((layer) => layer.id === art.id) ? 'picked' : ''} onClick={() => addLayer(art)} title={art.title}><img src={art.pickerUrl ?? art.previewUrl} srcSet={art.pickerLargeUrl ? `${art.pickerUrl} 600w, ${art.pickerLargeUrl} 1000w` : undefined} sizes="(max-width: 900px) 50vw, 200px" alt={art.title} loading="lazy" decoding="async" /></button>)}{artworks.length > 0 && filteredArtworks.length === 0 && <p className="picker-empty">검색 결과가 없어요.</p>}{pickerLimit < filteredArtworks.length && <button className="picker-more" onClick={() => setPickerLimit((limit) => limit + PICKER_PAGE_SIZE)}>더 불러오기 <span>{visibleArtworks.length}/{filteredArtworks.length}</span></button>}</div></aside>
        <section className="stage-area">
          <div className="stage" ref={stageRef} style={{ backgroundColor: BACKGROUND, aspectRatio: canvasSize.width / canvasSize.height, width: `min(100%, ${72 * canvasSize.width / canvasSize.height}vh)` }} onPointerDown={() => { setActive(null); setSelectedIds([]) }}>
            {guides.x !== null && <span className="snap-guide vertical" style={{ left: `${guides.x / canvasSize.width * 100}%` }} />}
            {guides.y !== null && <span className="snap-guide horizontal" style={{ top: `${guides.y / canvasSize.height * 100}%` }} />}
            {selectionBounds && <div className="selection-group" style={{ left: `${selectionBounds.left / canvasSize.width * 100}%`, top: `${selectionBounds.top / canvasSize.height * 100}%`, width: `${selectionBounds.width / canvasSize.width * 100}%`, height: `${selectionBounds.height / canvasSize.height * 100}%` }}><span>{selectedIds.length}개 선택됨</span>{!fixedSize && ['tl', 'tr', 'bl', 'br'].map((corner) => <button key={corner} className={`resize-handle ${corner}`} aria-label={`선택 그룹 ${corner} 모서리 크기 조절`} onPointerDown={(event) => beginGroupResize(event, corner)} />)}</div>}
            {layers.map((layer) => <div key={layer.id} className={`stage-item ${selectedIds.includes(layer.id) ? 'selected' : ''} ${selectedIds.length > 1 && selectedIds.includes(layer.id) ? 'multi-selected' : ''} ${active === layer.id ? 'active' : ''}`} onPointerDown={(event) => beginAction(event, 'move', layer)} style={{ left: `${layer.x / canvasSize.width * 100}%`, top: `${layer.y / canvasSize.height * 100}%`, width: `${layer.width / canvasSize.width * 100}%`, transform: `rotate(${layer.rotation}deg)`, zIndex: layers.indexOf(layer) + 1 }}>
              <img src={layer.previewUrl} alt={layer.title} draggable="false" />
              {selectedIds.includes(layer.id) && <span className="selection-check" aria-hidden="true">✓</span>}
              {active === layer.id && selectedIds.length === 1 && <><button className="rotate-handle" aria-label="회전" onPointerDown={(event) => beginAction(event, 'rotate', layer)} />{!fixedSize && ['tl', 'tr', 'bl', 'br'].map((corner) => <button key={corner} className={`resize-handle ${corner}`} aria-label={`${corner} 모서리 크기 조절`} onPointerDown={(event) => beginAction(event, 'resize', layer, corner)} />)}</>}
            </div>)}
            {!layers.length && <div className="empty-stage"><span>+</span><p>왼쪽에서 작품을 선택하세요</p></div>}
          </div>
          <p className="stage-help">이곳은 작업 영역이에요. 최종 캔버스는 작품 전체의 바깥쪽 외곽선에 자동으로 맞춰져요.</p>
        </section>
        <aside className="controls">
          <div className="panel-title"><span>조합 설정</span></div>
          <div className="mode-control"><p>조합 방식</p><div>{Object.entries(MODES).map(([value, option]) => <button key={value} className={mode === value ? 'selected' : ''} onClick={() => changeMode(value)}>{option.label}</button>)}</div><span>{fixedSize ? `50호 크기 고정 · 배치와 회전만 가능 · ${layers.length}/${MODES[mode].limit}점` : '작품 크기, 배치, 회전을 자유롭게 조절'}</span></div>
          <div className="composition-map-section">
            <div className="canvas-control-title"><p>최종 캔버스</p><span>{exportFrame ? `${exportFrame.width} × ${exportFrame.height}` : '자동 맞춤'}</span></div>
            <div className="composition-map" style={{ backgroundColor: BACKGROUND, aspectRatio: exportFrame ? exportFrame.width / exportFrame.height : canvasSize.width / canvasSize.height, width: `min(100%, ${300 * (exportFrame ? exportFrame.width / exportFrame.height : canvasSize.width / canvasSize.height)}px)` }}>
              {exportFrame?.layers.map((layer, index) => <button key={layer.id} className={selectedIds.includes(layer.id) ? 'selected' : ''} onClick={() => { setActive(layer.id); setSelectedIds([layer.id]) }} style={{ left: `${layer.x / exportFrame.width * 100}%`, top: `${layer.y / exportFrame.height * 100}%`, width: `${layer.width / exportFrame.width * 100}%`, transform: `rotate(${layer.rotation}deg)` }} title={layer.title}><img src={layer.previewUrl} alt="" /><span>{index + 1}</span></button>)}
              {!layers.length && <p>작품을 추가하면 설계도가 표시돼요.</p>}
            </div>
            <ol className="composition-list">{exportFrame?.layers.map((layer, index) => { const topLeft = bounds(layer); return <li key={layer.id}><button onClick={() => { setActive(layer.id); setSelectedIds([layer.id]) }}><strong>{index + 1}. {layer.title}</strong><span>좌상단 {Math.round(topLeft.left)}, {Math.round(topLeft.top)}</span><span>크기 {Math.round(layer.width)} × {Math.round(layer.width * layer.ratio)} · {layer.rotation}°</span></button></li> })}</ol>
          </div>
          {activeLayer ? <><p className="active-name">{selectedIds.length > 1 ? `${selectedIds.length}개 작품 선택` : activeLayer.title}</p><p className="control-empty">{fixedSize ? '크기는 50호로 고정돼요. 배치와 90도 회전만 가능해요.' : selectedIds.length > 1 ? '선택 그룹의 네 모서리로 크기를 함께 조절할 수 있어요.' : '네 모서리는 크기 조절, 위쪽 원형 손잡이는 90도 회전이에요.'}</p><button className="remove-button" onClick={() => { setLayers(layers.filter((layer) => !selectedIds.includes(layer.id))); setActive(null); setSelectedIds([]) }}>선택 작품 제거</button></> : <p className="control-empty">클릭해서 한 작품을, Shift + 클릭으로 여러 작품을 선택할 수 있어요.</p>}
          <div className="blueprint-actions"><button onClick={downloadBlueprint}>설계도 PNG</button><button onClick={saveComposition}>조합 파일 저장</button><button onClick={() => fileInputRef.current?.click()}>조합 파일 불러오기</button><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importComposition} /></div>
          <div className="publish-panel"><p>작품 게시하기</p><input maxLength="80" value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="조합 작품 제목" /><textarea maxLength="2000" value={postDescription} onChange={(event) => setPostDescription(event.target.value)} placeholder="이 조합을 만든 생각과 이야기를 적어주세요." /><button onClick={publishComposition} disabled={publishing}>{publishing ? '게시 중...' : user ? '게시판에 올리기' : '로그인하고 게시하기'}</button><span>Compose와 다운로드는 로그인 없이 계속 사용할 수 있어요.</span></div>
          <button className="download-button" onClick={download}>작품 PNG 다운로드</button><button className="clear-button" onClick={() => { setLayers([]); setCanvasSize({ width: 1200, height: 900 }); setActive(null); setSelectedIds([]); setMessage('') }}>작업 영역 비우기</button><Link className="back-link" to="/gallery">← 작품 감상하기</Link>
        </aside>
      </div>
      {message && <div className="studio-toast" role="status" aria-live="polite">{message}</div>}
    </div>
  )
}
