import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const CANVAS = { width: 1200, height: 900 }
const SNAP_PX = 10
const BACKGROUNDS = [
  ['아이보리', '#eeeae1'], ['흰색', '#ffffff'], ['검정', '#171714'],
  ['회색', '#a9a59d'], ['남색', '#17243c'], ['적색', '#9f3024'],
]

export default function Editor() {
  const [artworks, setArtworks] = useState([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [layers, setLayers] = useState([])
  const [active, setActive] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [background, setBackground] = useState('#eeeae1')
  const [groupScale, setGroupScale] = useState(100)
  const [message, setMessage] = useState('')
  const [guides, setGuides] = useState({ x: null, y: null })
  const stageRef = useRef(null)
  const actionRef = useRef(null)

  useEffect(() => { fetch('/artworks/data.json').then((res) => res.json()).then(setArtworks).catch(() => setMessage('작품 목록을 불러오지 못했습니다.')) }, [])
  const activeLayer = layers.find((layer) => layer.id === active)
  const selectionBounds = useMemo(() => {
    const selected = layers.filter((layer) => selectedIds.includes(layer.id))
    if (selected.length < 2) return null
    const left = Math.min(...selected.map((layer) => layer.x)); const top = Math.min(...selected.map((layer) => layer.y))
    const right = Math.max(...selected.map((layer) => layer.x + layer.width)); const bottom = Math.max(...selected.map((layer) => layer.y + layer.width * layer.ratio))
    return { left, top, width: right - left, height: bottom - top }
  }, [layers, selectedIds])
  const filteredArtworks = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase()
    if (!query) return artworks
    const numberQuery = query.replace(/\D/g, '')
    return artworks.filter((art) => art.title.toLowerCase().includes(query) || (numberQuery && art.title.replace(/\D/g, '').includes(numberQuery)))
  }, [artworks, pickerQuery])

  function addLayer(art) {
    if (layers.some((layer) => layer.id === art.id)) { setActive(art.id); setSelectedIds([art.id]); return }
    const width = 420 * groupScale / 100
    const next = { ...art, x: 100 + layers.length * 35, y: 90 + layers.length * 30, width, ratio: 1, rotation: 0 }
    setLayers([...layers, next]); setActive(art.id); setSelectedIds([art.id]); setMessage('')
  }

  function updateRatio(id, image) {
    const ratio = image.naturalHeight / image.naturalWidth
    setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ratio } : layer))
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
    const rect = stageRef.current.getBoundingClientRect(); const scale = rect.width / CANVAS.width
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

  function snapDelta(action, deltaX, deltaY, scale) {
    const moving = layers.filter((layer) => action.movingIds.includes(layer.id))
    const stationary = layers.filter((layer) => !action.movingIds.includes(layer.id))
    if (!moving.length || !stationary.length) return { deltaX, deltaY, guideX: null, guideY: null }
    const left = Math.min(...moving.map((layer) => action.startPositions[layer.id].x)) + deltaX
    const top = Math.min(...moving.map((layer) => action.startPositions[layer.id].y)) + deltaY
    const right = Math.max(...moving.map((layer) => action.startPositions[layer.id].x + layer.width)) + deltaX
    const bottom = Math.max(...moving.map((layer) => action.startPositions[layer.id].y + layer.width * layer.ratio)) + deltaY
    const threshold = SNAP_PX / scale; let bestX = null; let bestY = null
    for (const other of stationary) {
      const otherRight = other.x + other.width; const otherBottom = other.y + other.width * other.ratio
      for (const [movingEdge, fixedEdge] of [[left, other.x], [left, otherRight], [right, other.x], [right, otherRight]]) {
        const distance = fixedEdge - movingEdge
        if (Math.abs(distance) <= threshold && (!bestX || Math.abs(distance) < Math.abs(bestX.distance))) bestX = { distance, guide: fixedEdge }
      }
      for (const [movingEdge, fixedEdge] of [[top, other.y], [top, otherBottom], [bottom, other.y], [bottom, otherBottom]]) {
        const distance = fixedEdge - movingEdge
        if (Math.abs(distance) <= threshold && (!bestY || Math.abs(distance) < Math.abs(bestY.distance))) bestY = { distance, guide: fixedEdge }
      }
    }
    return { deltaX: deltaX + (bestX?.distance ?? 0), deltaY: deltaY + (bestY?.distance ?? 0), guideX: bestX?.guide ?? null, guideY: bestY?.guide ?? null }
  }

  function handlePointerMove(event) {
    const action = actionRef.current
    if (!action || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect(); const scale = rect.width / CANVAS.width
    const layer = layers.find((item) => item.id === action.id)
    if (!layer) return
    if (action.type === 'move') {
      const deltaX = (event.clientX - action.startX) / scale; const deltaY = (event.clientY - action.startY) / scale
      const snapped = snapDelta(action, deltaX, deltaY, scale)
      setLayers((current) => current.map((item) => action.movingIds.includes(item.id) ? { ...item, x: action.startPositions[item.id].x + snapped.deltaX, y: action.startPositions[item.id].y + snapped.deltaY } : item))
      setGuides({ x: snapped.guideX, y: snapped.guideY })
    }
    if (action.type === 'resize') {
      const pointerX = (event.clientX - rect.left) / scale; const pointerY = (event.clientY - rect.top) / scale
      const angle = -layer.rotation * Math.PI / 180; const dx = pointerX - action.anchor.x; const dy = pointerY - action.anchor.y
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle); const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
      const width = Math.min(1100, Math.max(100, Math.max(Math.abs(localX), Math.abs(localY) / layer.ratio)))
      const height = width * layer.ratio; const forward = layer.rotation * Math.PI / 180
      const centerDx = action.signs[0] * width / 2; const centerDy = action.signs[1] * height / 2
      const centerX = action.anchor.x + centerDx * Math.cos(forward) - centerDy * Math.sin(forward)
      const centerY = action.anchor.y + centerDx * Math.sin(forward) + centerDy * Math.cos(forward)
      setLayers((current) => current.map((item) => item.id === action.id ? { ...item, width, x: centerX - width / 2, y: centerY - height / 2 } : item))
    }
    if (action.type === 'rotate') {
      const angle = Math.atan2(event.clientY - action.centerY, event.clientX - action.centerX)
      let rotation = action.rotation + (angle - action.startAngle) * 180 / Math.PI
      const nearest = Math.round(rotation / 45) * 45
      if (Math.abs(rotation - nearest) < 4) rotation = nearest
      setLayers((current) => current.map((item) => item.id === action.id ? { ...item, rotation: Math.round(rotation) } : item))
    }
  }

  function endAction() { actionRef.current = null; setGuides({ x: null, y: null }) }

  function moveLayer(direction) {
    if (!selectedIds.length) return
    const selected = layers.filter((layer) => selectedIds.includes(layer.id)); const rest = layers.filter((layer) => !selectedIds.includes(layer.id))
    setLayers(direction === 'up' ? [...rest, ...selected] : [...selected, ...rest])
  }

  function scaleComposition(nextScale) {
    if (!layers.length || nextScale === groupScale) return setGroupScale(nextScale)
    const left = Math.min(...layers.map((layer) => layer.x)); const top = Math.min(...layers.map((layer) => layer.y))
    const right = Math.max(...layers.map((layer) => layer.x + layer.width)); const bottom = Math.max(...layers.map((layer) => layer.y + layer.width * layer.ratio))
    const centerX = (left + right) / 2; const centerY = (top + bottom) / 2; const factor = nextScale / groupScale
    setLayers((current) => current.map((layer) => {
      const width = layer.width * factor; const height = width * layer.ratio
      const layerCenterX = centerX + (layer.x + layer.width / 2 - centerX) * factor
      const layerCenterY = centerY + (layer.y + layer.width * layer.ratio / 2 - centerY) * factor
      return { ...layer, width, x: layerCenterX - width / 2, y: layerCenterY - height / 2 }
    }))
    setGroupScale(nextScale)
  }

  async function download() {
    if (!layers.length) return setMessage('먼저 작품을 하나 이상 추가해주세요.')
    setMessage('고해상도 이미지를 만드는 중...')
    try {
      const canvas = document.createElement('canvas'); canvas.width = CANVAS.width; canvas.height = CANVAS.height
      const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height)
      for (const layer of layers) {
        const img = new Image(); img.crossOrigin = 'anonymous'; img.src = layer.originalUrl; await img.decode()
        const height = layer.width * img.naturalHeight / img.naturalWidth
        ctx.save(); ctx.translate(layer.x + layer.width / 2, layer.y + height / 2); ctx.rotate(layer.rotation * Math.PI / 180)
        ctx.drawImage(img, -layer.width / 2, -height / 2, layer.width, height); ctx.restore()
      }
      const link = document.createElement('a'); link.download = `leesahm-composition-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click(); setMessage('다운로드가 완료됐어요.')
    } catch { setMessage('원본 이미지를 불러오지 못했습니다. Hostinger 원본 폴더를 확인해주세요.') }
  }

  return (
    <div className="compose-page" onPointerMove={handlePointerMove} onPointerUp={endAction} onPointerCancel={endAction}>
      <header className="compose-header"><div><p className="eyebrow">Interactive studio</p><h1>Compose</h1></div><p>작품을 변형하지 않고, 위치와 크기만 조절해 새로운 관계를 만들어보세요.</p></header>
      <div className="studio">
        <aside className="art-picker"><div className="panel-title"><span>작품 선택</span><span>{layers.length}개</span></div><label className="picker-search"><span className="sr-only">작품 검색</span><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="작품 번호 검색" /></label><div className="picker-grid">{filteredArtworks.map((art) => <button key={art.id} className={layers.some((layer) => layer.id === art.id) ? 'picked' : ''} onClick={() => addLayer(art)} title={art.title}><img src={art.previewUrl} alt={art.title} loading="lazy" /></button>)}{artworks.length > 0 && filteredArtworks.length === 0 && <p className="picker-empty">검색 결과가 없어요.</p>}</div></aside>
        <section className="stage-area">
          <div className="stage" ref={stageRef} style={{ backgroundColor: background }} onPointerDown={() => { setActive(null); setSelectedIds([]) }}>
            {guides.x !== null && <span className="snap-guide vertical" style={{ left: `${guides.x / CANVAS.width * 100}%` }} />}
            {guides.y !== null && <span className="snap-guide horizontal" style={{ top: `${guides.y / CANVAS.height * 100}%` }} />}
            {selectionBounds && <div className="selection-group" style={{ left: `${selectionBounds.left / CANVAS.width * 100}%`, top: `${selectionBounds.top / CANVAS.height * 100}%`, width: `${selectionBounds.width / CANVAS.width * 100}%`, height: `${selectionBounds.height / CANVAS.height * 100}%` }}><span>{selectedIds.length}개 선택됨</span></div>}
            {layers.map((layer) => <div key={layer.id} className={`stage-item ${selectedIds.includes(layer.id) ? 'selected' : ''} ${selectedIds.length > 1 && selectedIds.includes(layer.id) ? 'multi-selected' : ''} ${active === layer.id ? 'active' : ''}`} onPointerDown={(event) => beginAction(event, 'move', layer)} style={{ left: `${layer.x / CANVAS.width * 100}%`, top: `${layer.y / CANVAS.height * 100}%`, width: `${layer.width / CANVAS.width * 100}%`, transform: `rotate(${layer.rotation}deg)`, zIndex: layers.indexOf(layer) + 1 }}>
              <img src={layer.previewUrl} alt={layer.title} draggable="false" onLoad={(event) => updateRatio(layer.id, event.currentTarget)} />
              {selectedIds.includes(layer.id) && <span className="selection-check" aria-hidden="true">✓</span>}
              {active === layer.id && selectedIds.length === 1 && <><button className="rotate-handle" aria-label="회전" onPointerDown={(event) => beginAction(event, 'rotate', layer)} />{['tl', 'tr', 'bl', 'br'].map((corner) => <button key={corner} className={`resize-handle ${corner}`} aria-label={`${corner} 모서리 크기 조절`} onPointerDown={(event) => beginAction(event, 'resize', layer, corner)} />)}</>}
            </div>)}
            {!layers.length && <div className="empty-stage"><span>+</span><p>왼쪽에서 작품을 선택하세요</p></div>}
          </div>
          <p className="stage-help">작품을 드래그해 이동하고 Shift + 클릭으로 여러 작품을 선택하세요. 선택 그룹도 가까운 가장자리에 자석처럼 붙어요.</p>
        </section>
        <aside className="controls"><div className="panel-title"><span>조합 설정</span></div><div className="group-scale"><div><p>전체 조합 크기</p><button onClick={() => scaleComposition(100)}>100%</button></div><div className="scale-row"><button onClick={() => scaleComposition(Math.max(40, groupScale - 10))} aria-label="전체 축소">−</button><input type="range" min="40" max="180" step="5" value={groupScale} onChange={(event) => scaleComposition(Number(event.target.value))} /><button onClick={() => scaleComposition(Math.min(180, groupScale + 10))} aria-label="전체 확대">+</button></div><span>{groupScale}%</span></div><div className="background-control"><p>배경색</p><div className="color-swatches">{BACKGROUNDS.map(([name, color]) => <button key={color} className={background === color ? 'selected' : ''} style={{ backgroundColor: color }} onClick={() => setBackground(color)} title={name} aria-label={`${name} 배경`} />)}</div><label className="custom-color">직접 선택<input type="color" value={background} onChange={(e) => setBackground(e.target.value)} /></label></div>
          {activeLayer ? <><p className="active-name">{selectedIds.length > 1 ? `${selectedIds.length}개 작품 선택` : activeLayer.title}</p><p className="control-empty">{selectedIds.length > 1 ? '선택된 작품을 함께 이동하거나 순서를 변경할 수 있어요.' : '네 모서리의 사각형은 크기 조절, 위쪽 원형 손잡이는 회전이에요.'}</p><div className="layer-buttons"><button onClick={() => moveLayer('up')}>앞으로</button><button onClick={() => moveLayer('down')}>뒤로</button></div><button className="remove-button" onClick={() => { setLayers(layers.filter((layer) => !selectedIds.includes(layer.id))); setActive(null); setSelectedIds([]) }}>선택 작품 제거</button></> : <p className="control-empty">클릭해서 한 작품을, Shift + 클릭으로 여러 작품을 선택할 수 있어요.</p>}
          <button className="download-button" onClick={download}>PNG 다운로드</button><button className="clear-button" onClick={() => { setLayers([]); setActive(null); setSelectedIds([]); setGroupScale(100); setMessage('') }}>캔버스 비우기</button>{message && <p className="studio-message">{message}</p>}<Link className="back-link" to="/gallery">← 작품 감상하기</Link>
        </aside>
      </div>
    </div>
  )
}
