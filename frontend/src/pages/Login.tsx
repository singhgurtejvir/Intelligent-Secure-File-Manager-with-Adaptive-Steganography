import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setToken } = useAuthStore()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await loginUser(email, password)
      setToken(response.token, response.userId, response.email)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="auth-scene">
      <div className="auth-shell glass-panel">
        <span className="eyebrow">Your Files</span>
        <h1 className="auth-display">Welcome back.</h1>
        <p className="auth-copy">Sign in to continue into your personal workspace.</p>

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input"
              placeholder="name@example.com"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
              placeholder="Your passphrase"
            />
          </label>
          {error ? <div className="inline-alert inline-alert-error">{error}</div> : null}
          <button type="submit" className="button-primary auth-submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Need an account? <Link to="/register">Create one here</Link>
        </p>
      </div>
    </section>
  )
}
