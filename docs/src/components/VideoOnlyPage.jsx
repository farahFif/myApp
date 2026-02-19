import { useParams } from 'react-router-dom'
import VideoSegments from './VideoSegments.jsx'

export default function VideoOnlyPage() {
  const { lang, movie } = useParams()

  return (
    <section className="grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr' }}>
      <VideoSegments lang={lang} movie={movie} currentIndex={0} showSegments={false} />
    </section>
  )
}
