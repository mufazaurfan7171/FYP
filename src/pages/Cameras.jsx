import { useEffect, useState } from 'react'
import { PPE, ppeLabel, getCameras, saveCamera, saveRules } from '../api'
import { CameraStatus, Empty, ErrorBox, Field, Icon, Modal, Skeleton, Spinner, useToast } from '../components/ui'
import './Admin.css'

const blank = { name: '', streamUrl: '', location: '', active: true }

export default function Cameras() {
  const toast = useToast()
  const [cams, setCams] = useState(null)
  const [error, setError] = useState('')
  const [selId, setSelId] = useState(null)
  const [rules, setRules] = useState([])
  const [savingRules, setSavingRules] = useState(false)
  const [rulesError, setRulesError] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(blank)
  const [fields, setFields] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    setError('')
    setCams(null)
    getCameras().then((list) => {
      setCams(list)
      setSelId((id) => (list.some((c) => c.id === id) ? id : list[0]?.id ?? null))
    }).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const sel = cams?.find((c) => c.id === selId)
  useEffect(() => {
    setRules(sel ? sel.requiredPpe : [])
    setRulesError('')
  }, [selId, cams]) // eslint-disable-line

  const toggle = (k) => setRules((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]))

  async function onSaveRules() {
    setSavingRules(true)
    setRulesError('')
    try {
      const updated = await saveRules(sel.id, rules)
      setCams((l) => l.map((c) => (c.id === updated.id ? updated : c)))
      toast('PPE rules saved')
    } catch (e) {
      setRulesError(e.message)
    } finally {
      setSavingRules(false)
    }
  }

  function openModal(cam) {
    setForm(cam ? { id: cam.id, name: cam.name, streamUrl: cam.streamUrl, location: cam.location, active: cam.active } : blank)
    setFields({})
    setFormError('')
    setModal(true)
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFields({})
    setFormError('')
    try {
      const saved = await saveCamera(form)
      const isNew = !form.id
      setModal(false)
      toast(isNew ? 'Camera added' : 'Camera saved')
      if (isNew) setSelId(saved.id)
      setCams(await getCameras())
    } catch (err) {
      if (err.fields) setFields(err.fields)
      else setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Cameras and PPE rules</h1>
          <p>Choose a camera, then set the PPE it must check for.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal(null)}><Icon name="plus" />Add camera</button>
      </div>

      {error ? <ErrorBox message={error} onRetry={load} /> : (
        <div className="split">
          <section className="panel" aria-label="Cameras">
            <div className="table-wrap">
              {!cams ? (
                <div className="skel-rows">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} />)}</div>
              ) : cams.length === 0 ? (
                <Empty title="No cameras yet">Add a camera to start monitoring.</Empty>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Camera</th><th>Status</th><th>Required PPE</th><th><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {cams.map((c) => (
                      <tr key={c.id} className={`clickable${c.id === selId ? ' selected' : ''}${c.active ? '' : ' inactive'}`} onClick={() => setSelId(c.id)}>
                        <td>
                          <div className="row-name">
                            <button className="row-select" onClick={() => setSelId(c.id)} aria-pressed={c.id === selId}>{c.name}</button>
                            <span className="muted">{c.location}</span>
                            <span className="mono faint">{c.streamUrl}</span>
                          </div>
                        </td>
                        <td><CameraStatus camera={c} /></td>
                        <td>
                          {c.requiredPpe.length
                            ? c.requiredPpe.map(ppeLabel).join(', ')
                            : <span className="badge badge-yellow">No rules</span>}
                        </td>
                        <td>
                          <div className="cell-actions">
                            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openModal(c) }} aria-label={`Edit ${c.name}`}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel rules" aria-label="Required PPE">
            <div className="panel-head"><h2>Required PPE{sel ? `: ${sel.name}` : ''}</h2></div>
            <div className="panel-body rules-body">
              {!cams ? <Skeleton h={80} /> : !sel ? (
                <p className="muted">Select a camera to edit its rules.</p>
              ) : (
                <>
                  {sel.requiredPpe.length === 0 && (
                    <p className="notice notice-warn">No PPE rules. Violations are not checked for this camera.</p>
                  )}
                  <div className="chips" role="group" aria-label="Required PPE">
                    {PPE.map((p) => {
                      const on = rules.includes(p.key)
                      return (
                        <label key={p.key} className={`chip${on ? ' on' : ''}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(p.key)} />
                          <span className="tick">{on && <Icon name="check" size={11} />}</span>
                          {p.label}
                        </label>
                      )
                    })}
                  </div>
                  {rulesError && <ErrorBox message={rulesError} />}
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={onSaveRules} disabled={savingRules}>
                      {savingRules && <Spinner />}Save rules
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <Modal open={modal} title={form.id ? 'Edit camera' : 'Add camera'} onClose={() => setModal(false)}>
        <form className="form" onSubmit={onSubmit} noValidate>
          {formError && <ErrorBox message={formError} />}
          <Field label="Camera name" error={fields.name}>
            <input className="input" value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Stream URL" error={fields.streamUrl}>
            <input className="input" value={form.streamUrl} onChange={set('streamUrl')} placeholder="rtsp://192.168.1.20/stream1" />
          </Field>
          <Field label="Location" error={fields.location}>
            <input className="input" value={form.location} onChange={set('location')} />
          </Field>
          {form.id && (
            <label className="check-row"><input type="checkbox" checked={form.active} onChange={set('active')} />Active</label>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />}Save camera</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
