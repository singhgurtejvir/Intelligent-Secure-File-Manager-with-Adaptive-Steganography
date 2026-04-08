import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [showRecoveryKey, setShowRecoveryKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setToken, setRecoveryKey: storeRecoveryKey } = useAuthStore()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }

      const response = await registerUser(email, password)
      setRecoveryKey(response.recoveryKey)
      setShowRecoveryKey(true)
      setToken(response.token, response.userId, response.email)
      storeRecoveryKey(response.recoveryKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (showRecoveryKey) {
    return (
      <section className="auth-scene">
        <div className="auth-shell glass-panel">
          <span className="eyebrow">Recovery</span>
          <h1 className="auth-display">Store this key offline.</h1>
          <code className="fingerprint-code">{recoveryKey}</code>
          <p className="auth-copy">This is your fallback access path if the primary password is lost.</p>
          <button type="button" className="button-primary auth-submit" onClick={() => navigate('/')}>
            I have saved it
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="auth-scene">
      <div className="auth-shell glass-panel">
        <span className="eyebrow">Your Files</span>
        <h1 className="auth-display">Create your workspace.</h1>
        <p className="auth-copy">Set up your account and receive a recovery key for protected access.</p>

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
              placeholder="Minimum 8 characters"
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="field-input"
              placeholder="Repeat your password"
            />
          </label>
          {error ? <div className="inline-alert inline-alert-error">{error}</div> : null}
          <button type="submit" className="button-primary auth-submit" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in instead</Link>
        </p>
        <p className="auth-footer">
          Received a shared link or code? <Link to="/receive">Open the receiver screen</Link>
        </p>
      </div>
    </section>
  )
}
