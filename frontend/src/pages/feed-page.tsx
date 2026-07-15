import { useAuth } from '../auth/auth-context'

export function FeedPage() {
  const { user, logout } = useAuth()
  return (
    <div style={{ padding: 40, fontFamily: 'Poppins, sans-serif' }}>
      <h3>
        Feed coming next — logged in as {user?.firstName} {user?.lastName}
      </h3>
      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </div>
  )
}