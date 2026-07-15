import { Routes, Route } from 'react-router-dom'
import StaffDashboard from './pages/StaffDashboard'
import StatusPage from './pages/StatusPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<StaffDashboard />} />
      <Route path="/status" element={<StatusPage />} />
    </Routes>
  )
}

export default App
