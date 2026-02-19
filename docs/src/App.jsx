import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import LanguageSelect from './components/LanguageSelect.jsx'
import TaskPage from './components/TaskPage.jsx'
import VideoOnlyPage from './components/VideoOnlyPage.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LanguageSelect />} />
        <Route path="/video/:lang/:movie" element={<VideoOnlyPage />} />
        <Route path="/task/:lang/:movie/:index" element={<TaskPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
