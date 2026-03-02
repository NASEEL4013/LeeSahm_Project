import { useState, useEffect } from 'react'
import './Gallery.css'

export default function Gallery() {
    const [hoveredId, setHoveredId] = useState(null)
    const [artworks, setArtworks] = useState([])
    const [loading, setLoading] = useState(true)

    // 폴더 내 데이터를 묶어둔 JSON 파일을 불러옴
    useEffect(() => {
        fetch('/artworks/data.json')
            .then(res => res.json())
            .then(data => {
                setArtworks(data)
                setLoading(false)
            })
            .catch(error => {
                console.error("작품 데이터를 불러오는 중 오류가 발생했습니다:", error)
                setLoading(false)
            })
    }, [])

    return (
        <div className="page gallery">
            <header className="gallery-header">
                <h2>Curated Artworks</h2>
                <p>leesahm의 다채로운 디지털 아트 컬렉션을 탐험하세요.</p>
            </header>

            {loading ? (
                <p>로딩 중...</p>
            ) : artworks.length === 0 ? (
                <p style={{ marginTop: '2rem', color: '#888' }}>아직 등록된 작품이 없습니다. public/artworks 폴더에 이미지를 넣고 npm run update-gallery 스크립트를 실행해주세요.</p>
            ) : (
                <div className="masonry-grid">
                    {artworks.map((art) => (
                        <div
                            key={art.id}
                            className={`art-card ${hoveredId === art.id ? 'hovered' : ''} ${hoveredId && hoveredId !== art.id ? 'dimmed' : ''}`}
                            onMouseEnter={() => setHoveredId(art.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{ height: art.height }}
                        >
                            <img src={art.url} alt={art.title} loading="lazy" />
                            <div className="art-overlay">
                                <span className="art-title">{art.title}</span>
                                <button className="btn-edit" onClick={() => window.location.href = `/editor?img=${art.url}`}>
                                    Edit this Art
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
