import { Routes, Route, NavLink } from 'react-router-dom'
import PlansPage from './pages/PlansPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AnalyticsPage from './pages/AnalyticsPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex gap-6">
        <span className="font-semibold text-gray-800 mr-4">Galera Planner</span>
        <NavLink to="/" className={({ isActive }) =>
          isActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
        }>Планы</NavLink>
        <NavLink to="/approvals" className={({ isActive }) =>
          isActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
        }>Согласования</NavLink>
        <NavLink to="/analytics" className={({ isActive }) =>
          isActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
        }>Аналитика</NavLink>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<PlansPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </main>
    </div>
  )
}
