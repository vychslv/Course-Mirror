import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, isConfigured }) {
  if (!isConfigured) {
    return <Navigate to="/login" replace />
  }
  return children
}

