import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const artworksDir = path.join(__dirname, '../public/artworks')
const outputJson = path.join(artworksDir, 'data.json')

// public/artworks 폴더가 없으면 생성
if (!fs.existsSync(artworksDir)) {
    fs.mkdirSync(artworksDir, { recursive: true })
}

// 지원하는 이미지 확장자
const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

// 폴더 내 파일 읽기
const files = fs.readdirSync(artworksDir)
const artworks = []

let idCounter = 1

files.forEach((file) => {
    const ext = path.extname(file).toLowerCase()
    if (validExtensions.includes(ext)) {
        // 파일명에서 확장자를 제외한 부분을 기본 제목으로 사용 (언더바 등은 공백으로 치환)
        const baseName = path.basename(file, ext).replace(/[-_]/g, ' ')
        // 첫 글자 대문자로
        const title = baseName.charAt(0).toUpperCase() + baseName.slice(1)

        // 마모토 레이아웃을 위한 랜덤 높이 부여 (300px ~ 450px)
        const randomHeight = Math.floor(Math.random() * 150) + 300

        artworks.push({
            id: idCounter++,
            title: title || 'Untitled Art',
            url: `/artworks/${file}`,
            height: `${randomHeight}px`
        })
    }
})

// data.json 생성
fs.writeFileSync(outputJson, JSON.stringify(artworks, null, 2))
console.log(`✅ 성공적으로 ${artworks.length}개의 작품 데이터를 업데이트했습니다! (경로: public/artworks/data.json)`)
