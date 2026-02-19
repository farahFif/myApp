import { useEffect, useState } from 'react'

// --- constants ---

const AGE_GROUPS = ['Child', 'Teenage', 'Adult', 'Middle age', 'Elderly']

const GENDERS = ['Male', 'Female', 'Other', 'NA']

const ETHNICITIES = [
  'African / African Descent',
  'Arab / Middle Eastern / North African',
  'Central Asian',
  'South Asian (e.g., Indian, Pakistani, Bangladeshi)',
  'East Asian (e.g., Chinese, Japanese, Korean)',
  'Southeast Asian (e.g., Filipino, Vietnamese, Thai)',
  'Pacific Islander / Oceanian',
  'European / White',
  'Latino / Hispanic',
  'Indigenous / Native Peoples',
  'Mixed / Multi-ethnic',
  'Other',
  'NA',
]

const MARITAL_STATUSES = [
  'Married',
  'Single',
  'Divorced',
  'Separated',
  'Widowed',
  'Living together as married',
  'In a relationship/engaged',
  'NA',
]

const EDUCATION_TIER = [
  'Low Education',
  'Medium Education',
  'Higher Education',
  'NA',
]

const EDUCATION_DETAILS_BY_TIER = {
  'Low Education': ['Elementary', 'Secondary', 'NA'],
  'Medium Education': ['High School', 'Diploma (technical or vocational)', 'NA'],
  'Higher Education': ['Bachelor’s', 'Master’s', 'Doctoral', 'NA'],
  'NA': ['NA'],
}

const RELIGIONS = [
  'Buddhist',
  'Christian',
  'Hindu',
  'Muslim',
  'Jew',
  'Other religion',
  'Atheist',
  'NA',
]

const SOCIO_CLASSES = ['Upper', 'Middle', 'Lower', 'Other', 'NA']
const SOCIAL_CLASSES = ['Upper', 'Middle', 'Lower', 'Other', 'NA']

const OCCUPATION_TIER = [
  'Employed/self-employed',
  'No or unpaid employment',
  'NA',
]

const OCCUPATION_DETAILS_EMPLOYED = [
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
  'Military service',
  'Other',
  'NA',
]

const OCCUPATION_DETAILS_NONEMP = [
  'Retired',
  'Student',
  'Housewife',
  'Unemployed',
  'Other',
  'NA',
]

// simple country list (extend if you want)
const COUNTRIES = [
  'NA',
    'Fictional',
  'Afghanistan',
  'Algeria',
  'Argentina',
  'Australia',
  'Bangladesh',
  'Belgium',
  'Brazil',
  'Canada',
  'China',
  'Egypt',
  'France',
  'Germany',
  'India',
  'Indonesia',
  'Iraq',
  'Italy',
  'Japan',
  'Jordan',
  'Kenya',
  'Lebanon',
  'Mexico',
  'Morocco',
  'Netherlands',
  'Nigeria',
  'Pakistan',
  'Philippines',
  'Qatar',
  'Russia',
  'Saudi Arabia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sudan',
  'Sweden',
  'Switzerland',
  'Syria',
  'Tunisia',
  'Türkiye',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Other',
]

// Emotions as hierarchical checkboxes, stored as flat strings like "Love: Affection"
const EMOTIONS_TREE = {
  Love: ['Affection', 'Lust', 'Longing'],
  Joy: ['Cheerfulness', 'Zest', 'Contentment', 'Pride', 'Optimism','Enthrallment','Relief'],
  Anger: ['Irritability','Disgust', 'Rage', 'Frustration', 'Envy','Torment'],
  Sadness: ['Suffering', 'Sadness', 'Disappointment', 'Shame','Neglect','Sympathy'],
  Fear: ['Horror', 'Nervousness'],
  Surprise: ['Astonishment', 'Amazement'],
}

// Update these definitions when finalized by language.
const EMOTION_DEFINITIONS = {
English: {
  Love: 'Affection: A warm feeling of fondness and care toward someone or something. Lust: An intense physical or sexual desire for someone. Longing: A deep, persistent desire for someone or something that is absent.',
  Joy: 'Cheerfulness: A lighthearted and visibly happy state of mind. Zest: Energetic enthusiasm and eager enjoyment of life. Contentment: A peaceful sense of satisfaction with what one has. Pride: A feeling of pleasure or fulfillment from achievements or qualities. Optimism: Hopeful confidence that good things will happen. Enthrallment: Intense delight or captivation by something fascinating. Relief: A comforting release from worry, pain, or distress.',
  Anger: 'Irritability: A tendency to become annoyed or frustrated easily. Disgust: A strong feeling of revulsion or deep disapproval. Rage: Explosive and overwhelming anger. Frustration: Annoyance caused by blocked goals or unmet expectations. Envy: Resentful desire for what someone else has. Torment: Severe emotional pain or anguish.',
  Sadness: 'Suffering: The experience of emotional or physical pain. Sadness: A feeling of sorrow or unhappiness. Disappointment: Sadness caused by unmet expectations. Shame: Painful self-consciousness about perceived failure or wrongdoing. Neglect: A feeling of being ignored or uncared for. Sympathy: Compassionate sorrow for someone else’s suffering.',
  Fear: 'Horror: Intense fear mixed with shock or revulsion. Nervousness: Uneasy worry or tension about uncertainty or possible danger.',
  Surprise: 'Astonishment: Sudden and intense surprise caused by something unexpected. Amazement: A feeling of wonder and impressed surprise.'
},

Arabic: {
  Love: 'Affection (مودة): شعور دافئ بالمحبة والرعاية تجاه شخص أو شيء. Lust (شهوة): رغبة جسدية أو جنسية قوية تجاه شخص ما. Longing (اشتياق): رغبة عميقة ومستمرة لشيء أو شخص غائب.',
  Joy: 'Cheerfulness (مرح): حالة من السعادة الخفيفة الظاهرة على الشخص. Zest (حماس): طاقة وحيوية واستمتاع متحمّس بالحياة. Contentment (قناعة): شعور بالرضا والاطمئنان بما يملكه الإنسان. Pride (فخر): إحساس بالاعتزاز نتيجة إنجاز أو صفة إيجابية. Optimism (تفاؤل): توقع إيجابي وثقة بحدوث أمور جيدة. Enthrallment (انبهار): انجذاب وسرور شديد بشيء مدهش. Relief (ارتياح): شعور بالراحة بعد زوال قلق أو ألم.',
  Anger: 'Irritability (استثارة/تهيج): قابلية سريعة للانزعاج أو الغضب. Disgust (اشمئزاز): شعور قوي بالنفور أو القرف. Rage (غضب عارم): غضب شديد ومتفجر. Frustration (إحباط): ضيق أو غضب بسبب تعطل الأهداف. Envy (حسد): رغبة ممتزجة بالاستياء لما يملكه الآخرون. Torment (عذاب): ألم نفسي شديد ومستمر.',
  Sadness: 'Suffering (معاناة): تجربة الألم النفسي أو الجسدي. Sadness (حزن): شعور بالكآبة أو الأسى. Disappointment (خيبة أمل): حزن بسبب عدم تحقق التوقعات. Shame (خجل/عار): شعور مؤلم بالذنب أو النقص. Neglect (إهمال): إحساس بعدم الاهتمام أو التقدير. Sympathy (تعاطف): مشاركة وجدانية لحزن أو ألم الآخرين.',
  Fear: 'Horror (رعب): خوف شديد مصحوب بصدمة أو فزع. Nervousness (توتر): قلق وانزعاج بسبب توقع خطر أو موقف غير مؤكد.',
  Surprise: 'Astonishment (دهشة): مفاجأة قوية ومفاجئة بسبب أمر غير متوقع. Amazement (ذهول/إعجاب): دهشة ممزوجة بالإعجاب والانبهار.'
}
}

// --- component ---

export default function ProfileForm({
  onClose,
  onSave,
  defaultValue,
  speakers = [],
  draftLang,
  draftTaskId,
  uiLang,
}) {
  const [activeEmotionTip, setActiveEmotionTip] = useState('')

  const [form, setForm] = useState(() => ({
    name: '',
    ageGroup: '',
    gender: '',
    genderOther: '',
    ethnicity: '',
    maritalStatus: '',
    educationTier: '',
    education: '',
    religion: '',
    occupationTier: '',
    occupationDetail: '',
    occupationOther: '',
    socioEconomicClass: '',
    socioEconomicOther: '',
    socialClass: '',
    socialClassOther: '',
    emotions: [], // array of strings "Love: Affection", etc. plus maybe "NA"
    country: '',
    // if you had more fields before, add them here
    ...(defaultValue || {}),
  }))

  // keep in sync when editing a profile
  useEffect(() => {
    if (defaultValue) {
      const incoming = {
        ...defaultValue,
      }
      if (!incoming.educationTier && incoming.education) {
        incoming.educationTier = Object.entries(EDUCATION_DETAILS_BY_TIER).find(([, levels]) =>
          levels.includes(incoming.education),
        )?.[0] || ''
      }
      setForm((prev) => ({
        ...prev,
        ...incoming,
      }))
    }
  }, [defaultValue])

  // basic helpers
  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const toggleEmotion = (key) => {
    setForm((prev) => {
      const set = new Set(prev.emotions || [])
      if (set.has(key)) set.delete(key)
      else set.add(key)
      // if NA is selected, remove all others, or if any non-NA is added, remove NA
      if (set.has('NA') && set.size > 1) {
        set.delete('NA')
      }
      return {
        ...prev,
        emotions: Array.from(set),
      }
    })
  }

  // simple frontend required-check to avoid empty submits
  const handleSubmit = (e) => {
    e.preventDefault()

    const requiredFields = [
      'name',
      'ageGroup',
      'gender',
      'ethnicity',
      'maritalStatus',
      'educationTier',
      'education',
      'religion',
      'occupationTier',
      'occupationDetail',
      'socioEconomicClass',
      'socialClass',
      'country',
    ]

    for (const f of requiredFields) {
      if (!form[f] || String(form[f]).trim() === '') {
        alert('Please fill in all required fields before saving the profile.')
        return
      }
    }

    onSave(form)
  }

  // occupation detail options based on tier
  const occupationDetailsOptions =
    form.occupationTier === 'Employed/self-employed'
      ? OCCUPATION_DETAILS_EMPLOYED
      : form.occupationTier === 'No or unpaid employment'
      ? OCCUPATION_DETAILS_NONEMP
      : form.occupationTier === 'NA'
      ? ['NA']
      : []

  const educationDetailsOptions = EDUCATION_DETAILS_BY_TIER[form.educationTier] || []

  const isArabicUi = String(uiLang || '').toLowerCase() === 'arabic'
  const defsByUiLang = isArabicUi ? EMOTION_DEFINITIONS.Arabic : EMOTION_DEFINITIONS.English
  const missingDefText = isArabicUi ? 'لم يتم إضافة تعريف بعد' : 'Definition not added yet'
  const getDefinitionBullets = (emotion) => {
    const raw = defsByUiLang?.[emotion] || missingDefText
    return String(raw)
      .replace(/\r/g, '')
      .split(/(?<=[.!?۔])\s+|\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // render helpers
  const renderEmotionCheckboxes = () => {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {Object.entries(EMOTIONS_TREE).map(([cat, subs]) => (
          <div key={cat} style={{ padding: 6, borderRadius: 6, background: '#f5f5f5' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <strong>{cat}</strong>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  aria-label={`${cat} definition`}
                  onMouseEnter={() => setActiveEmotionTip(cat)}
                  onMouseLeave={() => setActiveEmotionTip('')}
                  onFocus={() => setActiveEmotionTip(cat)}
                  onBlur={() => setActiveEmotionTip('')}
                  onClick={() => setActiveEmotionTip((prev) => (prev === cat ? '' : cat))}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '1px solid #7a7a7a',
                    color: '#4f4f4f',
                    fontSize: 11,
                    lineHeight: '14px',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'help',
                    userSelect: 'none',
                    padding: 0,
                    background: '#fff',
                    minWidth: 16,
                  }}
                >
                  ?
                </button>
                {activeEmotionTip === cat && (
                  <span
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      left: 20,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#111',
                      color: '#fff',
                      fontSize: 14,
                      lineHeight: 1.5,
                      borderRadius: 6,
                      padding: '10px 12px',
                      whiteSpace: 'normal',
                      width: 360,
                      zIndex: 20,
                      textAlign: 'left',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    }}
                  >
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {getDefinitionBullets(cat).map((item, i) => (
                        <li key={`${cat}-tip-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </span>
                )}
              </span>
            </span>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subs.map((sub) => {
                const key = `${cat}: ${sub}`
                const checked = (form.emotions || []).includes(key)
                return (
                  <label key={key} className="radio">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEmotion(key)}
                    />
                    {sub}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        <div>
          <strong>NA</strong>
          <div style={{ marginTop: 4 }}>
            <label className="radio">
              <input
                type="checkbox"
                checked={(form.emotions || []).includes('NA')}
                onChange={() => toggleEmotion('NA')}
              />
              Not applicable / cannot be inferred
            </label>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <form onSubmit={handleSubmit} className="form-grid">
        {/* Name (from speakers dropdown) */}
        <label>
          <strong>Name *</strong>
          <select
            value={form.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            required
          >
            <option value="" disabled>
              Select speaker…
            </option>
            {speakers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Age group */}
        <label>
          <strong>Age group *</strong>
          <select
            value={form.ageGroup || ''}
            onChange={(e) => updateField('ageGroup', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {AGE_GROUPS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        {/* Gender */}
        <div style={{ gridColumn: '1 / -1' }}>
          <strong>Gender *</strong>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 4,
            }}
          >
            {GENDERS.map((g) => (
              <label key={g} className="radio">
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={form.gender === g}
                  onChange={(e) => updateField('gender', e.target.value)}
                  required
                />
                {g}
              </label>
            ))}
          </div>
          {form.gender === 'Other' && (
            <div style={{ marginTop: 6 }}>
              <input
                type="text"
                placeholder="Specify gender"
                value={form.genderOther || ''}
                onChange={(e) => updateField('genderOther', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Ethnicity */}
        <label>
          <strong>Ethnicity *</strong>
          <select
            value={form.ethnicity || ''}
            onChange={(e) => updateField('ethnicity', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {ETHNICITIES.map((eth) => (
              <option key={eth} value={eth}>
                {eth}
              </option>
            ))}
          </select>
        </label>

        {/* Marital status */}
        <label>
          <strong>Marital status *</strong>
          <select
            value={form.maritalStatus || ''}
            onChange={(e) => updateField('maritalStatus', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {MARITAL_STATUSES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {/* Education */}
        <label>
          <strong>Education level (tier) *</strong>
          <select
            value={form.educationTier || ''}
            onChange={(e) => {
              const newTier = e.target.value
              setForm((prev) => ({
                ...prev,
                educationTier: newTier,
                education: '', // reset detail when tier changes
              }))
            }}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {EDUCATION_TIER.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Education level (detail) *</strong>
          <select
            value={form.education || ''}
            onChange={(e) => updateField('education', e.target.value)}
            required
            disabled={educationDetailsOptions.length === 0}
          >
            <option value="" disabled>
              {educationDetailsOptions.length === 0 ? 'Select tier first' : 'Select…'}
            </option>
            {educationDetailsOptions.map((ed) => (
              <option key={ed} value={ed}>
                {ed}
              </option>
            ))}
          </select>
        </label>

        {/* Religion */}
        <label>
          <strong>Religion *</strong>
          <select
            value={form.religion || ''}
            onChange={(e) => updateField('religion', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {RELIGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {/* Socio-economic class */}
        <label>
          <strong>Socio-economic class *</strong>
          <select
            value={form.socioEconomicClass || ''}
            onChange={(e) => updateField('socioEconomicClass', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {SOCIO_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {form.socioEconomicClass === 'Other' && (
            <div style={{ marginTop: 6 }}>
              <input
                type="text"
                placeholder="Specify socio-economic class"
                value={form.socioEconomicOther || ''}
                onChange={(e) => updateField('socioEconomicOther', e.target.value)}
              />
            </div>
          )}
        </label>

        {/* Social class */}
        <label>
          <strong>Social class *</strong>
          <select
            value={form.socialClass || ''}
            onChange={(e) => updateField('socialClass', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {SOCIAL_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {form.socialClass === 'Other' && (
            <div style={{ marginTop: 6 }}>
              <input
                type="text"
                placeholder="Specify social class"
                value={form.socialClassOther || ''}
                onChange={(e) => updateField('socialClassOther', e.target.value)}
              />
            </div>
          )}
        </label>

        {/* Occupation */}
        <label>
          <strong>Occupation (tier) *</strong>
          <select
            value={form.occupationTier || ''}
            onChange={(e) => {
              const newTier = e.target.value
              setForm((prev) => ({
                ...prev,
                occupationTier: newTier,
                occupationDetail: newTier === 'NA' ? 'NA' : '', // keep NA as valid complete response
              }))
            }}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {OCCUPATION_TIER.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Occupation (detail) *</strong>
          <select
            value={form.occupationDetail || ''}
            onChange={(e) => updateField('occupationDetail', e.target.value)}
            required
            disabled={occupationDetailsOptions.length === 0}
          >
            <option value="" disabled>
              {occupationDetailsOptions.length === 0
                ? 'Select tier first'
                : 'Select…'}
            </option>
            {occupationDetailsOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {form.occupationDetail === 'Other' && (
            <div style={{ marginTop: 6 }}>
              <input
                type="text"
                placeholder="Specify occupation"
                value={form.occupationOther || ''}
                onChange={(e) => updateField('occupationOther', e.target.value)}
              />
            </div>
          )}
        </label>

        {/* Country */}
        <label>
          <strong>Country *</strong>
          <select
            value={form.country || ''}
            onChange={(e) => updateField('country', e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Emotions */}
        <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
          <strong>Emotional status (multiple) </strong>
          <div style={{ marginTop: 6 }}>{renderEmotionCheckboxes()}</div>
        </div>

        {/* Buttons */}
        <div
          style={{
            gridColumn: '1 / -1',
            marginTop: 12,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn">
            Save profile
          </button>
        </div>
      </form>
    </div>
  )
}
