import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <img className="hero-art-a" src="/artworks/previews/001-1riNwZli.webp" alt="" />
          <img className="hero-art-b" src="/artworks/previews/075-14ze9-ej.webp" alt="" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">The flow of time and effort</p>
          <h1>파동이 만나<br />하나의 흐름이 되다</h1>
          <p>Lee Sahm의 회화와, 작품 사이에서 새롭게 태어나는 관계를 경험하세요.</p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/gallery">작품 감상하기</Link>
            <Link className="text-link" to="/compose">나만의 조합 만들기 <span>↗</span></Link>
          </div>
        </div>
        <span className="hero-index">001 — 390</span>
      </section>
      <section className="home-statement">
        <p className="eyebrow">Statement</p>
        <p className="statement-text">반복되는 선은 시간의 기록이 되고,<br />서로 다른 파동은 새로운 장면을 만든다.</p>
        <Link className="text-link" to="/about">작가와 작품 세계</Link>
      </section>
      <section className="home-featured">
        <div>
          <p className="eyebrow">Selected works</p>
          <h2>작품의 표면을<br />천천히 들여다보기</h2>
          <Link className="button button-light" to="/gallery">전체 작품 보기</Link>
        </div>
        <div className="featured-images">
          <img src="/artworks/previews/120-1ewyeyw1.webp" alt="Lee Sahm 작품 120" loading="lazy" />
          <img src="/artworks/previews/200-16NpL5Si.webp" alt="Lee Sahm 작품 200" loading="lazy" />
          <img src="/artworks/previews/300-1eyIdwLm.webp" alt="Lee Sahm 작품 300" loading="lazy" />
        </div>
      </section>
    </div>
  )
}
