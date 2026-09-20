/* eslint-disable react/prop-types */
import { compositionFrame, physicalMapping } from '../editorGeometry.js'
import { CM_PER_PIXEL } from '../composition.js'

export default function CompositionMap({ layers, canvasSize = { width: 1200, height: 900 }, selectedIds = [], onSelect }) {
  const frame = compositionFrame(layers)
  const mapping = physicalMapping(layers, CM_PER_PIXEL)
  const ratio = frame ? frame.width / frame.height : canvasSize.width / canvasSize.height
  const Item = onSelect ? 'button' : 'div'
  return <section className="composition-map-section" aria-label="오프라인 배치도">
    <div className="canvas-control-title"><p>오프라인 배치도</p><span>{mapping ? `${mapping.width} × ${mapping.height}cm` : '자동 맞춤'}</span></div>
    <div className="composition-map" style={{ backgroundColor: '#a9a59d', aspectRatio: ratio, width: `min(100%, ${300 * ratio}px)` }}>
      {frame?.layers.map((layer, index) => <Item key={layer.id} className={`composition-map-artwork ${selectedIds.includes(layer.id) ? 'selected' : ''}`} onClick={onSelect ? () => onSelect(layer.id) : undefined} style={{ left: `${layer.x / frame.width * 100}%`, top: `${layer.y / frame.height * 100}%`, width: `${layer.width / frame.width * 100}%`, aspectRatio: 1 / layer.ratio, transform: `rotate(${layer.rotation}deg)` }} title={layer.title}><img src={layer.previewUrl} alt="" /><span>{index + 1}</span></Item>)}
      {!layers.length && <p>작품을 추가하면 설계도가 표시돼요.</p>}
    </div>
    <ol className="composition-list">{mapping?.placements.map((placement, index) => <li key={placement.artworkId}><Item className="composition-list-item" onClick={onSelect ? () => onSelect(placement.artworkId) : undefined}><strong>{index + 1}. {placement.title}</strong><span>왼쪽 위 X {placement.x}cm · Y {placement.y}cm</span><span>회전 {placement.rotation}°</span></Item></li>)}</ol>
  </section>
}
