import { useState } from 'react'
import './Gallery.css'

// 더미 이미지 데이터 (실제 프로젝트에서는 외부 API나 로컬 assets 등 사용)
const ARTWORKS = [
    { id: 1, title: 'Neon Dreams', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop', height: '300px' },
    { id: 2, title: 'Digital Soul', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop', height: '400px' },
    { id: 3, title: 'Synthetic Nature', url: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?q=80&w=600&auto=format&fit=crop', height: '250px' },
    { id: 4, title: 'Abstract Reality', url: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=600&auto=format&fit=crop', height: '350px' },
    { id: 5, title: 'Cyber Pulse', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop', height: '380px' },
    { id: 6, title: 'Quantum Flow', url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600&auto=format&fit=crop', height: '280px' },
]

export default function Gallery() {
    const [hoveredId, setHoveredId] = useState(null)

    return (
        <div className="page gallery">
            <header className="gallery-header">
                <h2>Curated Artworks</h2>
                <p>leesahm의 다채로운 디지털 아트 컬렉션을 탐험하세요.</p>
            </header>

            <div className="masonry-grid">
                {ARTWORKS.map((art) => (
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
        </div>
    )
}
