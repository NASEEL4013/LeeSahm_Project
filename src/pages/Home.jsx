import './Home.css'

export default function Home() {
    return (
        <div className="page home">
            <section className="hero">
                <div className="hero-content">
                    <h1 className="glitch" data-text="leesahm">leesahm</h1>
                    <p className="subtitle">Digital Artist & Creative Technologist</p>
                    <div className="bio">
                        <p>leesahm의 작업은 아날로그의 감성과 디지털 기술의 완벽한 조화를 추구합니다.</p>
                        <p>우리가 인지하지 못하는 일상의 순간들을 새로운 시각적 언어로 재해석하며, 관객이 단순히 작품을 감상하는 것을 넘어 직접 참여하고 교감할 수 있는 인터랙티브 아트를 선보이고 있습니다.</p>
                    </div>
                    <div className="cta-container">
                        <a href="/gallery" className="btn primary">View Gallery</a>
                        <a href="/editor" className="btn secondary">Try Editor</a>
                    </div>
                </div>
            </section>
        </div>
    )
}
