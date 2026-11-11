import { useEffect, useState } from 'react'
import { ROLES, roleLabel, getUsers, saveUser, setUserActive } from '../api'
import { useAuth } from '../auth'
import { Empty, ErrorBox, Field, Icon, Modal, Skeleton, Spinner, useToast } from '../components/ui'
import './Admin.css'

const blank = { name: '', email: '', role: 'supervisor', password: '' }

export default function Users() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(blank)
  const [fields, setFields] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setError('')
    setUsers(null)
    getUsers().then(setUsers).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  function openModal(u) {
    setForm(u ? { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, password: '' } : blank)
    setFields({})
    setFormError('')
    setModal(true)
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFields({})
    setFormError('')
    try {
      await saveUser(form)
      setModal(false)
      toast(form.id ? 'User updated' : 'User created')
      setUsers(await getUsers())
    } catch (err) {
      if (err.fields) setFields(err.fields)
      if (!err.fields || err.fields.email) setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onConfirm() {
    setBusy(true)
    setConfirmError('')
    try {
      await setUserActive(confirm.id, false)
      setConfirm(null)
      toast('User deactivated')
      setUsers(await getUsers())
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function reactivate(u) {
    try {
      await setUserActive(u.id, true)
      toast('User reactivated')
      setUsers(await getUsers())
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p>Each user has one role that decides what they can see and do.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal(null)}><Icon name="plus" />Add user</button>
      </div>

      {error ? <ErrorBox message={error} onRetry={load} /> : (
        <section className="panel" aria-label="Users">
          <div className="table-wrap">
            {!users ? (
              <div className="skel-rows">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={40} />)}</div>
            ) : users.length === 0 ? (
              <Empty title="No users yet">Add a user to give someone access.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'inactive'}>
                      <td>
                        <strong>{u.name}</strong>{' '}
                        {u.id === me.id && <span className="badge">You</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>{roleLabel(u.role)}</td>
                      <td>{u.active ? <span className="badge badge-green">Active</span> : <span className="badge">Deactivated</span>}</td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-sm" onClick={() => openModal(u)} aria-label={`Edit ${u.name}`}>Edit</button>
                          {u.id !== me.id && (u.active
                            ? <button className="btn btn-sm btn-danger" onClick={() => { setConfirmError(''); setConfirm(u) }} aria-label={`Deactivate ${u.name}`}>Deactivate</button>
                            : <button className="btn btn-sm" onClick={() => reactivate(u)} aria-label={`Reactivate ${u.name}`}>Reactivate</button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <Modal open={modal} title={form.id ? 'Edit user' : 'Add user'} onClose={() => setModal(false)}>
        <form className="form" onSubmit={onSubmit} noValidate>
          {formError && <ErrorBox message={formError} />}
          <Field label="Name" error={fields.name}>
            <input className="input" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email" error={fields.email}>
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Role" error={fields.role}>
            <select className="select" value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
          <Field label={form.id ? 'New password (leave blank to keep)' : 'Password'} error={fields.password}>
            <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />}Save user</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirm} title="Deactivate user" onClose={() => setConfirm(null)}>
        <div className="form">
          {confirmError && <ErrorBox message={confirmError} />}
          <p>Deactivate {confirm?.name}? They will no longer be able to sign in.</p>
          <div className="form-actions">
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy && <Spinner />}Deactivate</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
