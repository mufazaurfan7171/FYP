import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../auth'
import { ErrorBox, Field, Spinner } from '../components/ui'
import './Login.css'

const DEMO = [
  { label: 'System Admin', email: 'admin@sentinex.test' },
  { label: 'Factory Manager', email: 'manager@sentinex.test' },
  { label: 'Safety Supervisor', email: 'supervisor@sentinex.test' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(email, password)
      navigate(homeFor(user.role), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function fillDemo(acc) {
    setEmail(acc.email)
    setPassword('password')
    setError('')
  }

  return (
    <div className="login">
      <div className="login-brand">
        <div className="wordmark login-wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          <span className="wordmark-text">SENTINEX</span>
        </div>
        <p className="login-tagline">PPE and safety monitoring for factory CCTV.</p>
        <div className="login-band" aria-hidden="true" />
      </div>

      <div className="login-form-wrap">
        <div className="login-form">
          <div>
            <h1>Sign in</h1>
            <p className="muted login-lead">Use the account your System Admin gave you.</p>
          </div>

          {error && <ErrorBox message={error} />}

          <form className="form" onSubmit={submit}>
            <Field label="Email">
              <input
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
              {busy && <Spinner />}
              Sign in
            </button>
          </form>

          <div className="login-demo">
            <p className="faint">Demo accounts. The password for all of them is "password".</p>
            <div className="login-demo-list">
              {DEMO.map((acc) => (
                <button key={acc.email} type="button" className="btn btn-sm btn-ghost" onClick={() => fillDemo(acc)}>
                  <span>{acc.label}</span>
                  <span className="faint">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
