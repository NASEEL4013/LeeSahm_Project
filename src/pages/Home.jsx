import './Home.css'

export default function Home() {
    return (
        <div className="page home">
            <section className="hero">
                <div className="hero-content">
                    <h1 className="wave-title">THE FLOW OF TIME AND EFFORT</h1>
                    <p className="subtitle">일상의 시간, 그리고 끊임없는 수고로움은 하나의 선이 되어 파동을 만들어냅니다.</p>
                    <div className="bio">
                        <p>반복되는 선들은 저의 일상이자, 시간과 노력을 묵묵히 쌓아 올린 기록입니다.</p>
                        <p>작은 파동들이 모여 하나의 온전한 흐름이 되듯, 각각의 그림들은 서로 만나고 겹치며 더 거대한 에너지를 표현합니다.</p>
                        <p className="bio-highlight">저의 파동이 당신에게 닿아, 새로운 울림이 되기를 바랍니다.</p>
                    </div>
                    <div className="cta-container">
                        <a href="/gallery" className="btn primary wave-btn">흐름 감상하기</a>
                        <a href="/editor" className="btn secondary outline-btn">파동 얹어보기</a>
                    </div>
                </div>
            </section>
        </div>
    )
}
