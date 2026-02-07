import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import Layout from './components/layout/Layout'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import SpacesPage from './components/spaces/SpacesPage'
import BoardPage from './components/kanban/BoardPage'
import CalendarPage from './components/calendar/CalendarPage'
import SettingsPage from './components/settings/SettingsPage'
import AgentDashboard from './components/spaces/AgentDashboard'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/spaces" />} />
                <Route path="/spaces" element={<SpacesPage />} />
                <Route path="/spaces/:spaceId" element={<BoardPage />} />
                <Route path="/spaces/:spaceId/kanban" element={<BoardPage />} />
                <Route path="/spaces/:spaceId/calendar" element={<CalendarPage />} />
                <Route path="/spaces/:spaceId/dashboard" element={<AgentDashboard />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
