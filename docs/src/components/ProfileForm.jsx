import { useEffect, useMemo, useState } from 'react'
import { saveDraft, clearDraft } from '../utils/storage.js'

const AGE_GROUPS = ['child','teenage','adult','middle age','elderly']
const GENDERS = ['male','female','other','NA']
const ETHNICITIES = [
  'African / African Descent',
  'Arab / Middle Eastern / North African',
  'Central Asian',
  'South Asian (e.g., Indian, Pakistani, Bangladeshi)',
  'East Asian (e.g., Chinese, Japanese, Korean)',
  'Southeast Asian (e.g., Filipino, Vietnamese, Thai)',
  'Pacific Islander / Oceanian',
  'European / Caucasian',
  'Latino / Hispanic',
  'Indigenous / Native Peoples',
  'Mixed / Multi-ethnic',
  'Other',
  'NA'
]
const MARITAL = [
  'Married','Single','Divorced','Separated','Widowed',
  'Living together as married','In a relationship/engaged','NA'
]
const EDUCATION = [
  'Elementary','Secondary','High school','Diplomas',
  'Bachelor’s','Master’s','Doctoral','NA','Other'
]
const RELIGION = ['Buddhist','Christian','Hindu','Muslim','Jew','Other religion','Atheist','NA']

const OCCUPATION = {
  Employed: [
    'self-employed',
    'Manager',
    'Professional',
    'Technicians and associate professionals',
    'Clerical support workers',
    'Service and sales workers',
    'Skilled agricultural, forestry and fishery workers',
    'Craft and related trades workers',
    'Plant and machine operators and assemblers',
    'Elementary occupations',
    'Armed forces occupations',
    'Military service'
  ],
  'No or unpaid employment': ['Retired','Student','Housewife','Unemployed'],
  NA: ['NA']
}

const SOCIO_ECON_CLASSES = ['Upper','Middle','Lower','Other','NA']
const SOCIAL_CLASSES = ['Upper','Middle','Lower','Other','NA']

const EMOTIONS = {
  Love: ['Affection','Lust','Longing','Caring','Tenderness'],
  Joy: ['Amusement','Bliss','Glee','Exhilaration','Satisfaction'],
  Anger: ['Hostility','Rage','Frustration','Resentment'],
  Sadness: ['Grief','Despair','Disappointment','Remorse'],
  Fear: ['Anxiety','Terror','Worry','Panic'],
  Surprise: ['Astonishment','Confusion','Realization'],
  NA: ['No clear emotion']
}

const COUNTRIES = [
    'NA', 'Fictional','Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Congo-Brazzaville)','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Cyprus','Czechia',
  'Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Guatemala',
  'Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway','Oman',
  'Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
]

export default function ProfileForm({ onClose, onSave, defaultValue, draftLang, draftTaskId, speakers = [] }) {
  const [form, setForm] = useState(() => ({
    name: '',
    ageGroup: '',
    gender: '',
    genderOther: '',
    ethnicity: '',
    ethnicityOther: '',
    maritalStatus: '',
    education: '',
    educationOther: '',
    religion: '',
    religionOther: '',
    occupationTier: 'Employed',
    occupationDetail: '',
    occupationDetailOther: '',
    socioEconomicClass: '',
    socioEconomicOther: '',   // NEW
    socialClass: '',
    socialClassOther: '',     // NEW
    country: '',
    emotions: [],
  }))
  const isEditing = Boolean(defaultValue?.id)

  useEffect(() => {
    if (defaultValue) setForm(prev => ({ ...prev, ...defaultValue }))
  }, [defaultValue])

  useEffect(() => {
    if (draftLang && draftTaskId != null && !isEditing) {
      saveDraft(draftLang, draftTaskId, form)
    }
  }, [form, draftLang, draftTaskId, isEditing])

  const details = useMemo(() => OCCUPATION[form.occupationTier] || [], [form.occupationTier])

  const update = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const toggleEmotion = (primary, secondary, checked) => {
    const key = `${primary}|${secondary}`
    setForm(f => {
      const set = new Set(f.emotions || [])
      if (checked) set.add(key); else set.delete(key)
      return { ...f, emotions: Array.from(set) }
    })
  }
  const clearEmotions = () => setForm(f => ({ ...f, emotions: [] }))
  const isEmotionChecked = (p, s) => (form.emotions || []).includes(`${p}|${s}`)

  const submit = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      gender: form.gender === 'other' && form.genderOther ? form.genderOther : form.gender,
      ethnicity: form.ethnicity === 'Other' && form.ethnicityOther ? form.ethnicityOther : form.ethnicity,
      education: form.education === 'Other' && form.educationOther ? form.educationOther : form.education,
      religion: form.religion?.startsWith('Other') && form.religionOther ? form.religionOther : form.religion,
      occupationDetail: form.occupationDetail === 'Other' && form.occupationDetailOther ? form.occupationDetailOther : form.occupationDetail,
      // NEW: write "Other" custom values if provided
      socioEconomicClass:
        form.socioEconomicClass === 'Other' && form.socioEconomicOther
          ? form.socioEconomicOther
          : form.socioEconomicClass,
      socialClass:
        form.socialClass === 'Other' && form.socialClassOther
          ? form.socialClassOther
          : form.socialClass,
    }
    onSave?.(payload)
    if (!isEditing && draftLang && draftTaskId != null) clearDraft(draftLang, draftTaskId)
    onClose?.()
  }

  const show = {
    genderOther: form.gender === 'other',
    ethnicityOther: form.ethnicity === 'Other',
    educationOther: form.education === 'Other',
    religionOther: form.religion?.startsWith('Other'),
    occupationDetailOther: form.occupationDetail === 'Other',
    // NEW:
    socioEconomicOther: form.socioEconomicClass === 'Other',
    socialClassOther: form.socialClass === 'Other',
  }

  const hasSpeakers = Array.isArray(speakers) && speakers.length > 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{isEditing ? 'Edit profile' : 'Add profile'}</h3>
        <form onSubmit={submit} className="form-grid">
          <label>
            <strong>Name</strong>
            {hasSpeakers ? (
              <select name="name" value={form.name} onChange={update}>
                <option value="" disabled>Select speaker…</option>
                {speakers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input name="name" value={form.name} onChange={update} placeholder="Full name" />
            )}
          </label>

          <label>
            <strong>Age group</strong>
            <select name="ageGroup" value={form.ageGroup} onChange={update}>
              <option value="" disabled>Select…</option>
              {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <fieldset className="fieldset">
            <legend><strong>Gender</strong></legend>
            <div className="row">
              {GENDERS.map(g => (
                <label key={g} className="radio">
                  <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={update} /> {g}
                </label>
              ))}
              {show.genderOther && (
                <span className="inline-other">
                  <input name="genderOther" value={form.genderOther} onChange={update} placeholder="Specify other…" />
                </span>
              )}
            </div>
          </fieldset>

          <label>
            <strong>Ethnicity</strong>
            <select name="ethnicity" value={form.ethnicity} onChange={update}>
              <option value="" disabled>Select…</option>
              {ETHNICITIES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          {show.ethnicityOther && (
            <label>
              <strong>Specify other ethnicity</strong>
              <input name="ethnicityOther" value={form.ethnicityOther} onChange={update} placeholder="Enter ethnicity" />
            </label>
          )}

          <label>
            <strong>Marital status</strong>
            <select name="maritalStatus" value={form.maritalStatus} onChange={update}>
              <option value="" disabled>Select…</option>
              {MARITAL.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <label>
            <strong>Education level</strong>
            <select name="education" value={form.education} onChange={update}>
              <option value="" disabled>Select…</option>
              {EDUCATION.map(ed => <option key={ed} value={ed}>{ed}</option>)}
            </select>
          </label>
          {show.educationOther && (
            <label>
              <strong>Specify other education</strong>
              <input name="educationOther" value={form.educationOther} onChange={update} placeholder="Enter education" />
            </label>
          )}

          <label>
            <strong>Religion</strong>
            <select name="religion" value={form.religion} onChange={update}>
              <option value="" disabled>Select…</option>
              {RELIGION.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Other religion">Other religion</option>
            </select>
          </label>
          {show.religionOther && (
            <label>
              <strong>Specify other religion</strong>
              <input name="religionOther" value={form.religionOther} onChange={update} placeholder="Enter religion" />
            </label>
          )}

          <label>
            <strong>Occupation tier</strong>
            <select name="occupationTier" value={form.occupationTier} onChange={update}>
              {Object.keys(OCCUPATION).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label>
            <strong>Occupation detail</strong>
            <select name="occupationDetail" value={form.occupationDetail} onChange={update}>
              <option value="" disabled>Select…</option>
              {details.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="Other">Other</option>
            </select>
          </label>
          {show.occupationDetailOther && (
            <label>
              <strong>Specify other occupation</strong>
              <input name="occupationDetailOther" value={form.occupationDetailOther} onChange={update} placeholder="Enter occupation" />
            </label>
          )}

          <label>
            <strong>Socio-economic class</strong>
            <select name="socioEconomicClass" value={form.socioEconomicClass} onChange={update}>
              <option value="" disabled>Select…</option>
              {SOCIO_ECON_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {show.socioEconomicOther && (
            <label>
              <strong>Specify other socio-economic class</strong>
              <input
                name="socioEconomicOther"
                value={form.socioEconomicOther}
                onChange={update}
                placeholder="Enter socio-economic class"
              />
            </label>
          )}

          <label>
            <strong>Social class</strong>
            <select name="socialClass" value={form.socialClass} onChange={update}>
              <option value="" disabled>Select…</option>
              {SOCIAL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {show.socialClassOther && (
            <label>
              <strong>Specify other social class</strong>
              <input
                name="socialClassOther"
                value={form.socialClassOther}
                onChange={update}
                placeholder="Enter social class"
              />
            </label>
          )}

          <label>
            <strong>Country</strong>
            <select name="country" value={form.country} onChange={update}>
              <option value="" disabled>Select…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* Emotions: hierarchical checkboxes */}
          <fieldset className="fieldset" style={{ gridColumn: 'span 2' }}>
            <legend><strong>Emotions (select multiple)</strong></legend>
            {Object.entries(EMOTIONS).map(([primary, secondaries]) => (
              <div key={primary} style={{ marginBottom: 8 }}>
                <strong style={{ display: 'inline-block', minWidth: 110 }}>{primary}</strong>
                <div className="row" style={{ marginTop: 6 }}>
                  {secondaries.map((sec) => {
                    const id = `${primary}-${sec}`
                    const checked = isEmotionChecked(primary, sec)
                    return (
                      <label key={id} className="radio">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleEmotion(primary, sec, e.target.checked)}
                        /> {sec}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="actions" style={{ justifyContent: 'flex-start', gridColumn: '1 / -1' }}>
              <button type="button" className="btn ghost" onClick={clearEmotions}>Clear emotions</button>
            </div>
          </fieldset>

          <div className="actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEditing ? 'Save changes' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
