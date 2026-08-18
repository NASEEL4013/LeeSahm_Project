import { useEffect, useMemo, useState } from 'react'

export default function Gallery() {
  const [artworks, setArtworks] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    fetch('/artworks/data.json').then((res) => {
      if (!res.ok) throw new Error('작품 목록을 불러오지 못했습니다.')
      return res.json()
    }).then(setArtworks).catch((err) => setError(err.message))
  }, [])

  const filtered = useMemo(() => artworks.filter((art) => art.title.toLowerCase().includes(query.toLowerCase())), [artworks, query])

  return (
    <div className="page-shell gallery-page">
      <header className="page-heading">
        <div><p className="eyebrow">Archive · {artworks.length || '—'} works</p><h1 className="display-title">Works</h1></div>
        <p>Lee Sahm의 작업에 축적된 선과 색, 화면을 가로지르는 리듬을 천천히 감상해보세요.</p>
      </header>
      <div className="gallery-tools">
        <label className="search"><span>작품 찾기</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작품 번호나 제목을 입력하세요" /></label>
        <span className="result-count">{filtered.length} works</span>
      </div>
      {error && <p className="status error">{error}</p>}
      {!error && !artworks.length && <p className="status">작품을 불러오는 중...</p>}
      <div className="works-grid">
        {filtered.map((art) => {
          return (
            <article className="work-card" key={art.id}>
              <button className="work-image" onClick={() => setViewing(art)} aria-label={`${art.title} 크게 보기`}>
                <img src={art.previewUrl} alt={art.title} loading="lazy" />
                <span className="view-mark">크게 보기 ↗</span>
              </button>
              <div className="work-meta"><span>{art.title}</span></div>
            </article>
          )
        })}
      </div>
      {artworks.length > 0 && filtered.length === 0 && <p className="status">일치하는 작품이 없습니다.</p>}
      {viewing && <div className="art-lightbox" role="dialog" aria-modal="true" aria-label={`${viewing.title} 확대 감상`} onClick={() => setViewing(null)}>
        <button className="lightbox-close" onClick={() => setViewing(null)} aria-label="닫기">×</button>
        <img src={viewing.originalUrl} alt={viewing.title} onError={(event) => { event.currentTarget.src = viewing.previewUrl }} onClick={(event) => event.stopPropagation()} />
        <p>{viewing.title}</p>
      </div>}
    </div>
  )
}
