/* ============================================================
   LunaCycle – app.js  (Tüm uygulama mantığı)
   ============================================================ */

// ─── State & Storage ────────────────────────────────────────
const STORAGE_KEYS = {
  SETTINGS: 'lc_settings',
  LOGS:     'lc_logs',
  PERIODS:  'lc_periods',
};

function loadData(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

const DEFAULTS = {
  cycleLength:   28,
  periodLength:  5,
  lutealLength:  14,
  lastPeriod:    null,
  goal:          'track',
  userName:      'Nazlı',
  userPin:       '',
  waterToday:    { date: '', cups: 0 },
};

let settings = (function() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
    // Merge: defaults first, then stored values on top — ensures new fields always exist
    return stored ? Object.assign({}, DEFAULTS, stored) : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
})();

let logs    = loadData(STORAGE_KEYS.LOGS, {});     // { 'YYYY-MM-DD': {...} }
let periods = loadData(STORAGE_KEYS.PERIODS, []);  // [ { start:'YYYY-MM-DD', end:'YYYY-MM-DD' } ]

// ─── Date Helpers ────────────────────────────────────────────
const fmt   = (d) => d.toISOString().slice(0, 10);
const parse = (s) => { const d = new Date(s + 'T12:00:00'); return d; };
const diffDays = (a, b) => Math.round((b - a) / 86400000);

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function todayStr() { return fmt(new Date()); }

function formatTR(dateStr) {
  if (!dateStr) return '—';
  const d = parse(dateStr);
  return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
}

function formatShortTR(dateStr) {
  if (!dateStr) return '—';
  const d = parse(dateStr);
  return d.toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
}

function monthNameTR(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('tr-TR', { month:'long', year:'numeric' });
}

// ─── Cycle Calculation ───────────────────────────────────────
function getCycleData(referenceDate) {
  const today      = referenceDate ? parse(referenceDate) : new Date();
  const cl         = settings.cycleLength || 28;
  const pl         = settings.periodLength || 5;
  const ll         = settings.lutealLength || 14;
  const lastPeriod = settings.lastPeriod ? parse(settings.lastPeriod) : null;

  if (!lastPeriod) return null;

  // Find current cycle start (closest past period start)
  let cycleStart = new Date(lastPeriod);
  while (addDays(cycleStart, cl) <= today) {
    cycleStart = addDays(cycleStart, cl);
  }
  // If today is before lastPeriod, go back
  if (cycleStart > today) cycleStart = lastPeriod;

  const cycleEnd    = addDays(cycleStart, cl - 1);
  const dayOfCycle  = diffDays(cycleStart, today) + 1;

  // Ovulation day (cycle length - luteal length)
  const ovulationDay   = cl - ll;
  const ovulationDate  = addDays(cycleStart, ovulationDay - 1);

  // Fertile window: 5 days before ovulation + ovulation day + 1 day after
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd   = addDays(ovulationDate, 1);

  // Period days
  const periodStart = cycleStart;
  const periodEnd   = addDays(cycleStart, pl - 1);

  // Next period
  const nextPeriodStart = addDays(cycleStart, cl);

  // Phase determination
  let phase = 'follicular';
  if (dayOfCycle <= pl) phase = 'menstrual';
  else if (today >= fertileStart && today < ovulationDate) phase = 'fertile-pre';
  else if (fmt(today) === fmt(ovulationDate)) phase = 'ovulation';
  else if (today > ovulationDate && today <= fertileEnd) phase = 'fertile-post';
  else if (today > fertileEnd) phase = 'luteal';

  // Pregnancy risk
  let pregnancyRisk = 'low';
  if (phase === 'ovulation') pregnancyRisk = 'very-high';
  else if (phase === 'fertile-pre' && diffDays(today, ovulationDate) <= 2) pregnancyRisk = 'high';
  else if (phase === 'fertile-pre') pregnancyRisk = 'medium';
  else if (phase === 'fertile-post') pregnancyRisk = 'medium';
  else if (phase === 'menstrual') pregnancyRisk = 'low';
  else pregnancyRisk = 'low';

  const daysToNextPeriod = diffDays(today, nextPeriodStart);
  const daysToOvulation  = diffDays(today, ovulationDate);

  return {
    today, cycleStart, cycleEnd, dayOfCycle,
    periodStart, periodEnd,
    ovulationDate, fertileStart, fertileEnd,
    nextPeriodStart, phase, pregnancyRisk,
    daysToNextPeriod, daysToOvulation,
    cycleLength: cl, periodLength: pl,
  };
}

// ─── Phase Info ──────────────────────────────────────────────
const PHASE_INFO = {
  menstrual: {
    icon: '🩸',
    title: 'Regl Dönemi',
    desc: 'Rahminiz, döşenme katmanını atıyor. Kendinize iyi bakın, bol su için.',
    color: 'var(--pink-500)',
  },
  follicular: {
    icon: '🌸',
    title: 'Foliküler Faz',
    desc: 'Vücudunuz yumurtlama için hazırlanıyor. Enerji seviyeleri yükseliyor!',
    color: 'var(--purple-400)',
  },
  'fertile-pre': {
    icon: '🔥',
    title: 'Fertil Dönem (Yumurtlama Yaklaşıyor)',
    desc: 'Fertil penceredeysiniz! Yumurtlama yaklaşıyor, hamilelik olasılığı yüksek.',
    color: '#f59e0b',
  },
  ovulation: {
    icon: '🥚',
    title: 'Yumurtlama Günü!',
    desc: 'Bugün yumurtlama gününüz. Hamilelik olasılığı en yüksek seviyede.',
    color: '#f59e0b',
  },
  'fertile-post': {
    icon: '⚡',
    title: 'Fertil Dönem (Yumurtlama Sonrası)',
    desc: 'Yumurta henüz canlı. Fertil pencere bitiyor.',
    color: '#f59e0b',
  },
  luteal: {
    icon: '🌙',
    title: 'Lüteal Faz',
    desc: 'Progesteron yükseliyor. PMS belirtileri olabilir, kendinize nazik davranın.',
    color: 'var(--lavender)',
  },
};

const RISK_LABELS = {
  low:       { label: '✅ Düşük Risk',        cls: 'risk-low' },
  medium:    { label: '⚠️ Orta Risk',          cls: 'risk-medium' },
  high:      { label: '🔴 Yüksek Risk',        cls: 'risk-high' },
  'very-high': { label: '🚨 Çok Yüksek Risk', cls: 'risk-very-high' },
};

// ─── Alert Messages ──────────────────────────────────────────
function buildAlertMessage(cd, goal) {
  if (!cd) return null;

  const { phase, pregnancyRisk, daysToOvulation, daysToNextPeriod } = cd;

  if (phase === 'ovulation') {
    if (goal === 'avoid') {
      return { type: 'warning', title: '⚠️ Bugün Yumurtlama Günü!', text: 'Bugün yumurtlama gününüz. Eğer bugün ilişkiye girerseniz hamile kalma olasılığınız çok yüksek! Kesinlikle korunmanız önerilir.' };
    } else if (goal === 'conceive') {
      return { type: 'success', title: '🥚 Yumurtlama Günü – En İyi Zaman!', text: 'Bugün hamile kalmak için en uygun gün! Yumurtlama gerçekleşiyor ve bu fırsatı kaçırmamak için korunmadan ilişkiye girebilirsiniz.' };
    } else {
      return { type: 'info', title: '🥚 Bugün Yumurtlama Gününüz', text: 'Bugün yumurtlama gününüz. Korunmadan ilişkiye girerseniz hamile kalabilirsiniz. Lütfen durumunuza göre hareket edin.' };
    }
  }

  if (phase === 'fertile-pre') {
    const daysLeft = daysToOvulation;
    if (goal === 'avoid') {
      return { type: 'warning', title: `⚠️ Fertil Dönem – ${daysLeft} gün sonra yumurtlama`, text: `Fertil dönemdesiniz! ${daysLeft} gün sonra yumurtlama bekleniyor. Bu günlerde korunmadan ilişkiye girerseniz hamile kalma riskiniz yüksek. Korunma yöntemlerinizi kullanın.` };
    } else if (goal === 'conceive') {
      return { type: 'success', title: `🌟 Fertil Dönem – ${daysLeft} gün sonra yumurtlama!`, text: `Harika zaman! Yumurtlama ${daysLeft} gün sonra. Bu günlerde sık ilişkiye girmek hamile kalma şansınızı artırır.` };
    } else {
      return { type: 'info', title: `🔥 Fertil Dönem Başladı`, text: `Fertil dönemdesiniz, ${daysLeft} gün sonra yumurtlama bekleniyor. Korunmadan ilişkiye girerseniz hamile kalma olasılığınız var.` };
    }
  }

  if (phase === 'fertile-post') {
    if (goal === 'avoid') {
      return { type: 'warning', title: '⚠️ Yumurtlama Sonrası – Hâlâ Riskli', text: 'Yumurtlama gerçekleşti ancak yumurta hâlâ canlı olabilir. Bu gün ilişkiye girerseniz küçük bir hamile kalma riski var. Dikkatli olun.' };
    } else if (goal === 'conceive') {
      return { type: 'info', title: '🕐 Yumurtlama Sonrası', text: 'Yumurtlama gerçekleşti. Bu dönemde de küçük bir şans var. İki hafta sonra hamilelik testi yapabilirsiniz.' };
    }
  }

  if (phase === 'luteal' && daysToNextPeriod <= 5) {
    return { type: 'info', title: `📅 Regl ${daysToNextPeriod} Gün Sonra Bekleniyor`, text: `Regl döneminiz yaklaşıyor. Hazırlıklı olun. PMS belirtileri (şişkinlik, ruh hali değişimi, baş ağrısı) yaşayabilirsiniz.` };
  }

  if (phase === 'menstrual') {
    return { type: 'info', title: '🩸 Regl Döneminizdesiniz', text: 'Kendinize iyi bakın. Bol su ve sağlıklı beslenme bu dönemde çok önemli. Isı uygulaması kramp ağrısını hafifletebilir.' };
  }

  return null;
}

// ─── HOME PAGE ───────────────────────────────────────────────
function renderHome() {
  const today = new Date();
  document.getElementById('today-date-label').textContent =
    'Bugün: ' + today.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const cd = getCycleData();

  if (!cd) {
    document.getElementById('status-icon').textContent = '⚙️';
    document.getElementById('status-title').textContent = 'Ayarları Tamamlayın';
    document.getElementById('status-desc').textContent = 'Son regl tarihinizi girmek için Ayarlar sayfasına gidin.';
    document.getElementById('pregnancy-risk-badge').textContent = '—';
    document.getElementById('mini-badge-text').textContent = 'Son tarih girilmedi';
    return;
  }

  // Status Card
  const phaseInfo = PHASE_INFO[cd.phase] || PHASE_INFO.follicular;
  document.getElementById('status-icon').textContent = phaseInfo.icon;
  document.getElementById('status-title').textContent = phaseInfo.title;
  document.getElementById('status-desc').textContent  = phaseInfo.desc;

  const riskBadge = document.getElementById('pregnancy-risk-badge');
  const riskInfo  = RISK_LABELS[cd.pregnancyRisk];
  riskBadge.textContent  = riskInfo.label;
  riskBadge.className    = 'pregnancy-risk-badge ' + riskInfo.cls;

  // Phase strip
  document.querySelectorAll('.phase-item').forEach(el => el.classList.remove('active-phase'));
  const phaseMap = {
    menstrual: 'ph-menstrual',
    follicular: 'ph-follicular',
    'fertile-pre': 'ph-ovulation',
    ovulation: 'ph-ovulation',
    'fertile-post': 'ph-ovulation',
    luteal: 'ph-luteal',
  };
  const activePhaseEl = document.getElementById(phaseMap[cd.phase]);
  if (activePhaseEl) activePhaseEl.classList.add('active-phase');

  // Phase day ranges
  document.getElementById('ph-menstrual-days').textContent   = `1-${cd.periodLength} gün`;
  document.getElementById('ph-follicular-days').textContent  = `${cd.periodLength+1}-${cd.cycleLength - cd.lutealLength - 5} gün`;
  document.getElementById('ph-ovulation-days').textContent   = 'Fertil pencere';
  document.getElementById('ph-luteal-days').textContent      = `Son ${settings.lutealLength} gün`;

  // Info cards
  const nxtDays = cd.daysToNextPeriod;
  document.getElementById('next-period-val').textContent  = formatShortTR(fmt(cd.nextPeriodStart));
  document.getElementById('next-period-sub').textContent  = nxtDays === 0 ? 'Bugün bekleniyor!' : `${nxtDays} gün kaldı`;

  document.getElementById('ovulation-val').textContent    = formatShortTR(fmt(cd.ovulationDate));
  const ovDays = cd.daysToOvulation;
  document.getElementById('ovulation-sub').textContent    = ovDays > 0 ? `${ovDays} gün sonra` : ovDays === 0 ? 'Bugün!' : `${Math.abs(ovDays)} gün önce geçti`;

  document.getElementById('fertile-val').textContent      = formatShortTR(fmt(cd.fertileStart));
  document.getElementById('fertile-sub').textContent      = `${formatShortTR(fmt(cd.fertileStart))} – ${formatShortTR(fmt(cd.fertileEnd))}`;

  document.getElementById('cycle-length-val').textContent = cd.cycleLength;

  // Alert
  const alert = buildAlertMessage(cd, settings.goal);
  const alertBox = document.getElementById('pregnancy-alert');
  if (alert) {
    alertBox.style.display = 'flex';
    alertBox.className = 'alert-box alert-' + alert.type;
    document.getElementById('alert-title').textContent = alert.title;
    document.getElementById('alert-text').textContent  = alert.text;
  } else {
    alertBox.style.display = 'none';
  }

  // Cycle progress
  const pct = Math.min(100, Math.max(0, ((cd.dayOfCycle - 1) / cd.cycleLength) * 100));
  document.getElementById('cycle-progress-fill').style.width = pct + '%';
  document.getElementById('cycle-progress-thumb').style.left = pct + '%';
  document.getElementById('cycle-day-badge').textContent = `Gün ${cd.dayOfCycle} / ${cd.cycleLength}`;

  // Sidebar mini badge
  document.getElementById('mini-badge-text').textContent =
    `Gün ${cd.dayOfCycle} · ${phaseInfo.title}\nSonraki: ${formatShortTR(fmt(cd.nextPeriodStart))}`;

  // Greeting with name
  const name = settings.userName || 'Nazlı';
  const greetEl = document.getElementById('greeting-title');
  if (greetEl) greetEl.textContent = `Merhaba, ${name}! 💕`;
  const sidebarName = document.getElementById('user-name-sidebar');
  if (sidebarName) sidebarName.textContent = name;

  // Motivation + Phase Tips + Water
  renderMotivation(cd.phase);
  renderPhaseTips(cd.phase);
  renderWaterTracker();

  // Notification button state
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    document.getElementById('notif-btn')?.classList.add('active');
  }

  // Recent logs
  renderRecentLogs();
}

function renderRecentLogs() {
  const container = document.getElementById('recent-logs-home');
  const sorted = Object.entries(logs)
    .sort(([a],[b]) => b.localeCompare(a))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">Henüz kayıt yok. Günlük kayıt ekleyin! ✨</div>';
    return;
  }

  container.innerHTML = sorted.map(([date, log]) => {
    const tags = buildLogTags(log);
    return `<div class="log-entry" onclick="showPage('log')">
      <div class="log-entry-date">${formatShortTR(date)}</div>
      <div class="log-entry-tags">${tags}</div>
    </div>`;
  }).join('');
}

function buildLogTags(log) {
  let tags = '';
  if (log.period && log.period !== 'none') {
    const labels = {spotting:'Lekelenme', light:'Hafif', medium:'Orta', heavy:'Yoğun'};
    tags += `<span class="log-tag tag-period">🩸 ${labels[log.period]||log.period}</span>`;
  }
  if (log.mood) {
    const moodEmojis = {happy:'😊',sad:'😢',anxious:'😰',irritable:'😤',energetic:'⚡',tired:'😴',romantic:'💕',calm:'😌'};
    tags += `<span class="log-tag tag-mood">${moodEmojis[log.mood]||''} ${log.mood}</span>`;
  }
  if (log.symptoms && log.symptoms.length > 0) {
    tags += `<span class="log-tag tag-symptom">🌡️ ${log.symptoms.length} semptom</span>`;
  }
  if (log.sex && log.sex !== 'none') {
    tags += `<span class="log-tag tag-sex">💑 ${log.sex === 'protected' ? 'Korunaklı' : 'Korumasız'}</span>`;
  }
  return tags || '<span style="color:var(--text-muted);font-size:0.8rem">Kayıt var</span>';
}

// ─── CALENDAR ────────────────────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  document.getElementById('cal-month-title').textContent = monthNameTR(calYear, calMonth).replace(/^./, c => c.toUpperCase());

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);

  // Monday-based offset
  let startDow = firstDay.getDay();
  startDow = (startDow === 0) ? 6 : startDow - 1;

  const cd   = getCycleData();
  const today = fmt(new Date());

  const container = document.getElementById('calendar-days');
  container.innerHTML = '';

  // Empty cells
  for (let i = 0; i < startDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    container.appendChild(el);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = fmt(new Date(calYear, calMonth, d));
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.dataset.date = dateStr;

    if (dateStr === today) el.classList.add('today');

    // Color coding from logged data
    const log = logs[dateStr];
    if (log && log.period && log.period !== 'none') {
      el.classList.add('period-day');
      if (log.period === 'heavy') el.classList.add('heavy');
    }
    if (log) el.classList.add('has-log');

    // Predicted cycle colors
    if (cd) {
      const dObj = new Date(calYear, calMonth, d);
      const dObj12 = new Date(dateStr + 'T12:00:00');

      // Generate multiple future cycles for display
      const cl = cd.cycleLength;
      const pl = cd.periodLength;

      for (let n = -2; n <= 12; n++) {
        const cStart = addDays(cd.cycleStart, n * cl);
        const cEnd   = addDays(cStart, cl - 1);
        const pEnd   = addDays(cStart, pl - 1);
        const ov     = addDays(cStart, cl - settings.lutealLength - 1);
        const fStart = addDays(ov, -5);
        const fEnd   = addDays(ov, 1);

        if (dObj12 >= cStart && dObj12 <= pEnd) {
          if (!el.classList.contains('period-day')) {
            el.classList.add('predicted-period');
          }
        }
        if (dObj12 >= fStart && dObj12 <= fEnd) {
          if (!el.classList.contains('period-day') && !el.classList.contains('predicted-period')) {
            el.classList.add('fertile-day');
          }
        }
        if (fmt(dObj12) === fmt(ov)) {
          el.classList.remove('fertile-day');
          el.classList.add('ovulation-day');
        }
      }
    }

    el.addEventListener('click', () => showDayDetail(dateStr));
    container.appendChild(el);
  }
}

function calendarPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function calendarNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function showDayDetail(dateStr) {
  const panel = document.getElementById('day-detail-panel');
  panel.style.display = 'block';
  document.getElementById('day-detail-title').textContent = formatTR(dateStr);

  const log = logs[dateStr];
  const cd  = getCycleData();
  let html  = '';

  // Cycle phase for this date
  if (cd) {
    const cdDay = getCycleData(dateStr);
    if (cdDay) {
      const ph = PHASE_INFO[cdDay.phase] || PHASE_INFO.follicular;
      html += `<div class="log-tag tag-period" style="display:inline-block;margin-bottom:0.75rem">${ph.icon} ${ph.title}</div>`;
      const rk = RISK_LABELS[cdDay.pregnancyRisk];
      html += `<div class="pregnancy-risk-badge ${rk.cls}" style="display:inline-block;margin-bottom:0.75rem;margin-left:0.5rem">${rk.label}</div>`;
      html += '<br>';
    }
  }

  if (log) {
    const periodLabels = {none:'Yok',spotting:'Lekelenme',light:'Hafif',medium:'Orta',heavy:'Yoğun'};
    const moodEmojis   = {happy:'😊 Mutlu',sad:'😢 Üzgün',anxious:'😰 Endişeli',irritable:'😤 Sinirli',energetic:'⚡ Enerjik',tired:'😴 Yorgun',romantic:'💕 Romantik',calm:'😌 Sakin'};
    const sexLabels    = {none:'Hayır',protected:'Korunarak',unprotected:'Korunmadan'};
    const dischargeL   = {none:'Yok',dry:'Kuru',sticky:'Yapışkan',creamy:'Kremsi',watery:'Sulu',eggwhite:'Yumurta Akı'};

    html += `<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">`;
    const rows = [
      ['🩸 Regl', periodLabels[log.period] || '—'],
      ['😣 Ağrı', log.pain != null ? `${log.pain}/10` : '—'],
      ['😊 Ruh Hali', moodEmojis[log.mood] || '—'],
      ['💑 İlişki', sexLabels[log.sex] || '—'],
      ['💧 Akıntı', dischargeL[log.discharge] || '—'],
      ['🌡️ BBT', log.bbt ? `${log.bbt} °C` : '—'],
      ['🌡️ Semptomlar', log.symptoms && log.symptoms.length ? log.symptoms.join(', ') : '—'],
      ['📝 Not', log.notes || '—'],
    ];
    rows.forEach(([label, val]) => {
      html += `<tr><td style="padding:0.4rem 0.75rem 0.4rem 0;color:var(--text-secondary);white-space:nowrap">${label}</td><td style="padding:0.4rem 0;color:var(--text-primary)">${val}</td></tr>`;
    });
    html += '</table>';
    html += `<button class="btn-primary" style="margin-top:1rem;font-size:0.82rem;padding:0.4rem 1rem;" onclick="editLogForDate('${dateStr}')">Kaydı Düzenle ✏️</button>`;
  } else {
    html += `<p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem">Bu gün için kayıt yok.</p>`;
    html += `<button class="btn-primary" style="font-size:0.82rem;padding:0.4rem 1rem;" onclick="editLogForDate('${dateStr}')">Kayıt Ekle ✏️</button>`;
  }

  document.getElementById('day-detail-body').innerHTML = html;
}

function closeDayDetail() {
  document.getElementById('day-detail-panel').style.display = 'none';
}

function editLogForDate(dateStr) {
  showPage('log');
  setTimeout(() => {
    document.getElementById('log-date').value = dateStr;
    // Fill form if log exists
    const log = logs[dateStr];
    if (log) populateLogForm(log);
  }, 200);
}

// ─── LOG FORM ────────────────────────────────────────────────
function initLogForm() {
  document.getElementById('log-date').value = todayStr();
}

function setToggle(groupId, btn) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function toggleSymptom(btn) {
  btn.classList.toggle('selected');
}

function updateSliderLabel(sliderId, labelId) {
  const val = document.getElementById(sliderId).value;
  const labels = ['0 – Ağrı Yok','1','2','3','4','5 – Orta','6','7','8','9','10 – Dayanılmaz'];
  document.getElementById(labelId).textContent = labels[val] || val;
}

function getToggleVal(groupId) {
  const active = document.getElementById(groupId)?.querySelector('.toggle-btn.active');
  return active ? active.dataset.val : 'none';
}

function getMoodVal() {
  const sel = document.querySelector('.mood-btn.selected');
  return sel ? sel.dataset.val : null;
}

function getSymptoms() {
  return Array.from(document.querySelectorAll('.symptom-btn.selected')).map(b => b.dataset.val);
}

function clearLogForm() {
  document.getElementById('log-date').value = todayStr();
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('[data-val="none"]').forEach(b => {
    if (b.classList.contains('toggle-btn')) b.classList.add('active');
  });
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.symptom-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('pain-slider').value = 0;
  document.getElementById('pain-label').textContent = '0 – Ağrı Yok';
  document.getElementById('bbt-input').value = '';
  document.getElementById('log-notes').value = '';
}

function populateLogForm(log) {
  if (log.period) {
    const btn = document.querySelector(`#period-toggle [data-val="${log.period}"]`);
    if (btn) setToggle('period-toggle', btn);
  }
  if (log.sex) {
    const btn = document.querySelector(`#sex-toggle [data-val="${log.sex}"]`);
    if (btn) setToggle('sex-toggle', btn);
  }
  if (log.discharge) {
    const btn = document.querySelector(`#discharge-toggle [data-val="${log.discharge}"]`);
    if (btn) setToggle('discharge-toggle', btn);
  }
  if (log.mood) {
    const btn = document.querySelector(`.mood-btn[data-val="${log.mood}"]`);
    if (btn) { document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); }
  }
  if (log.symptoms) {
    document.querySelectorAll('.symptom-btn').forEach(b => {
      if (log.symptoms.includes(b.dataset.val)) b.classList.add('selected');
      else b.classList.remove('selected');
    });
  }
  if (log.pain != null) {
    document.getElementById('pain-slider').value = log.pain;
    updateSliderLabel('pain-slider', 'pain-label');
  }
  if (log.bbt) document.getElementById('bbt-input').value = log.bbt;
  if (log.notes) document.getElementById('log-notes').value = log.notes;
}

function saveLog() {
  const date = document.getElementById('log-date').value;
  if (!date) { showToast('❌ Lütfen bir tarih seçin!'); return; }

  const log = {
    period:     getToggleVal('period-toggle'),
    sex:        getToggleVal('sex-toggle'),
    discharge:  getToggleVal('discharge-toggle'),
    mood:       getMoodVal(),
    symptoms:   getSymptoms(),
    pain:       parseInt(document.getElementById('pain-slider').value),
    bbt:        parseFloat(document.getElementById('bbt-input').value) || null,
    notes:      document.getElementById('log-notes').value.trim(),
    savedAt:    new Date().toISOString(),
  };

  logs[date] = log;
  saveData(STORAGE_KEYS.LOGS, logs);

  // If period logged, update period tracking
  if (log.period && log.period !== 'none') {
    updatePeriodTracking(date, log.period);
  }

  showToast('✅ Kayıt başarıyla kaydedildi!');
  renderLogHistory();
  renderHome();
  renderCalendar();
}

function updatePeriodTracking(date, flow) {
  // Find if there's already a period spanning this date
  const existing = periods.find(p => {
    const start = parse(p.start);
    const end   = p.end ? parse(p.end) : start;
    const d     = parse(date);
    return d >= addDays(start,-1) && d <= addDays(end,1);
  });

  if (existing) {
    // Extend the period
    if (date < existing.start) existing.start = date;
    if (!existing.end || date > existing.end) existing.end = date;
  } else {
    periods.push({ start: date, end: date, flow });
  }

  // Auto-update settings.lastPeriod to earliest recent period
  const sortedPeriods = [...periods].sort((a,b) => b.start.localeCompare(a.start));
  if (sortedPeriods.length > 0 && (!settings.lastPeriod || sortedPeriods[0].start > settings.lastPeriod)) {
    settings.lastPeriod = sortedPeriods[0].start;
    saveData(STORAGE_KEYS.SETTINGS, settings);
    document.getElementById('setting-last-period').value = settings.lastPeriod;
  }

  saveData(STORAGE_KEYS.PERIODS, periods);
}

function renderLogHistory() {
  const container = document.getElementById('log-history-list');
  const sorted = Object.entries(logs).sort(([a],[b]) => b.localeCompare(a));

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">Henüz kayıt yok.</div>';
    return;
  }

  container.innerHTML = sorted.map(([date, log]) => {
    const periodLabels = {none:'Yok',spotting:'Lekelenme',light:'Hafif',medium:'Orta',heavy:'Yoğun'};
    const moodEmojis   = {happy:'😊',sad:'😢',anxious:'😰',irritable:'😤',energetic:'⚡',tired:'😴',romantic:'💕',calm:'😌'};
    const details = [];
    if (log.period && log.period !== 'none') details.push(`🩸 ${periodLabels[log.period]}`);
    if (log.mood) details.push(`${moodEmojis[log.mood]} ${log.mood}`);
    if (log.symptoms && log.symptoms.length) details.push(`🌡️ ${log.symptoms.length} semptom`);
    if (log.sex && log.sex !== 'none') details.push(`💑 ${log.sex === 'protected' ? 'Korunaklı' : 'Korumasız'}`);
    if (log.bbt) details.push(`🌡️ ${log.bbt}°C`);
    if (log.notes) details.push(`📝 "${log.notes.slice(0,40)}${log.notes.length>40?'…':''}"`);

    return `<div class="log-history-item">
      <button class="delete-log-btn" onclick="deleteLog('${date}', event)" title="Sil">🗑️</button>
      <div class="log-history-date">${formatTR(date)}</div>
      <div class="log-history-detail">${details.join(' · ') || 'Kayıt mevcut'}</div>
    </div>`;
  }).join('');
}

function deleteLog(date, e) {
  e.stopPropagation();
  delete logs[date];
  saveData(STORAGE_KEYS.LOGS, logs);
  renderLogHistory();
  renderRecentLogs();
  renderCalendar();
  showToast('🗑️ Kayıt silindi');
}

// ─── QUICK MARK PERIOD ───────────────────────────────────────
function quickMarkPeriod() {
  const date = todayStr();
  if (!logs[date]) logs[date] = {};
  logs[date].period   = 'medium';
  logs[date].savedAt  = new Date().toISOString();
  saveData(STORAGE_KEYS.LOGS, logs);
  updatePeriodTracking(date, 'medium');
  showToast('🩸 Bugün regl olarak işaretlendi!');
  renderHome();
  renderCalendar();
}

// ─── INSIGHTS ────────────────────────────────────────────────
function renderInsights() {
  const logEntries = Object.entries(logs);
  document.getElementById('stat-total-logs').textContent = logEntries.length || '0';
  document.getElementById('stat-cycles-tracked').textContent = periods.length || '0';

  // Avg cycle length from actual periods
  if (periods.length >= 2) {
    const sorted = [...periods].sort((a,b)=>a.start.localeCompare(b.start));
    let totalDays = 0, count = 0;
    for (let i = 1; i < sorted.length; i++) {
      const d = diffDays(parse(sorted[i-1].start), parse(sorted[i].start));
      if (d > 15 && d < 60) { totalDays += d; count++; }
    }
    if (count > 0) {
      document.getElementById('stat-avg-cycle').textContent = Math.round(totalDays/count);
    } else {
      document.getElementById('stat-avg-cycle').textContent = settings.cycleLength;
    }
  } else {
    document.getElementById('stat-avg-cycle').textContent = settings.cycleLength;
  }

  // Avg period length
  if (periods.length > 0) {
    const total = periods.reduce((sum, p) => {
      const d = p.end ? diffDays(parse(p.start), parse(p.end)) + 1 : 1;
      return sum + d;
    }, 0);
    document.getElementById('stat-avg-period').textContent = Math.round(total / periods.length);
  } else {
    document.getElementById('stat-avg-period').textContent = settings.periodLength;
  }

  // Cycle history
  const histList = document.getElementById('cycle-history-list');
  if (periods.length === 0) {
    histList.innerHTML = '<div class="empty-state">Henüz yeterli döngü verisi yok.</div>';
  } else {
    const sorted = [...periods].sort((a,b)=>b.start.localeCompare(a.start)).slice(0,6);
    histList.innerHTML = sorted.map((p, i) => {
      const days = p.end ? diffDays(parse(p.start), parse(p.end)) + 1 : 1;
      const pct  = Math.min(100, (days / 10) * 100);
      return `<div class="cycle-history-item">
        <div class="cycle-hist-num">${formatShortTR(p.start)}</div>
        <div class="cycle-hist-bar"><div class="cycle-hist-fill" style="width:${pct}%"></div></div>
        <div class="cycle-hist-days">${days} gün</div>
      </div>`;
    }).join('');
  }

  // Symptom analysis
  const symptomCounts = {};
  logEntries.forEach(([,log]) => {
    if (log.symptoms) log.symptoms.forEach(s => { symptomCounts[s] = (symptomCounts[s]||0)+1; });
  });
  const symptomChart = document.getElementById('symptom-chart');
  const symptomNames = {cramps:'Kramp',headache:'Baş Ağrısı',bloating:'Şişkinlik',backpain:'Sırt Ağrısı',nausea:'Bulantı',breast:'Göğüs Hass.',acne:'Akne',discharge:'Akıntı',fatigue:'Yorgunluk',insomnia:'Uyku Sorunu',appetite:'İştah',['ovulation-pain']:'Mittelschmerz'};
  const sorted = Object.entries(symptomCounts).sort((a,b)=>b[1]-a[1]);
  if (sorted.length === 0) {
    symptomChart.innerHTML = '<div class="empty-state">Kayıt eklendikçe semptom analizi görünecek.</div>';
  } else {
    const max = sorted[0][1];
    symptomChart.innerHTML = sorted.slice(0,8).map(([k,v]) =>
      `<div class="symptom-bar-row">
        <div class="symptom-bar-label">${symptomNames[k]||k}</div>
        <div class="symptom-bar"><div class="symptom-bar-fill" style="width:${(v/max)*100}%"></div></div>
        <div class="symptom-bar-count">${v}</div>
      </div>`).join('');
  }

  // Mood chart
  const moodCounts = {};
  logEntries.forEach(([,log]) => { if (log.mood) moodCounts[log.mood] = (moodCounts[log.mood]||0)+1; });
  const moodChart  = document.getElementById('mood-chart');
  const moodEmojis = {happy:'😊',sad:'😢',anxious:'😰',irritable:'😤',energetic:'⚡',tired:'😴',romantic:'💕',calm:'😌'};
  const moodSorted = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]);
  if (moodSorted.length === 0) {
    moodChart.innerHTML = '<div class="empty-state">Ruh hali kayıtlarınız burada görünecek.</div>';
  } else {
    moodChart.innerHTML = moodSorted.map(([k,v]) =>
      `<div class="mood-stat-item">
        <div class="mood-stat-emoji">${moodEmojis[k]||'❓'}</div>
        <div class="mood-stat-count">${v}x</div>
      </div>`).join('');
  }
}

// ─── SETTINGS ────────────────────────────────────────────────
function loadSettings() {
  document.getElementById('setting-cycle-length').value  = settings.cycleLength;
  document.getElementById('setting-period-length').value = settings.periodLength;
  document.getElementById('setting-luteal-length').value = settings.lutealLength;
  document.getElementById('setting-goal').value          = settings.goal;
  document.getElementById('setting-name').value          = settings.userName || 'Nazlı';
  // Show PIN as number (masked display)
  const pinEl = document.getElementById('setting-pin');
  if (pinEl) pinEl.value = settings.userPin || '';
  if (settings.lastPeriod) {
    document.getElementById('setting-last-period').value = settings.lastPeriod;
  }
}

function saveSettings() {
  settings.cycleLength   = parseInt(document.getElementById('setting-cycle-length').value) || 28;
  settings.periodLength  = parseInt(document.getElementById('setting-period-length').value) || 5;
  settings.lutealLength  = parseInt(document.getElementById('setting-luteal-length').value) || 14;
  settings.lastPeriod    = document.getElementById('setting-last-period').value || null;
  settings.goal          = document.getElementById('setting-goal').value;
  settings.userName      = document.getElementById('setting-name').value.trim() || 'Nazlı';
  // PIN: take raw value, keep only digits, max 4
  const rawPin = String(document.getElementById('setting-pin').value || '').replace(/\D/g,'').slice(0,4);
  settings.userPin = rawPin;
  saveData(STORAGE_KEYS.SETTINGS, settings);
  document.getElementById('user-name-sidebar').textContent = settings.userName;
  showToast(rawPin.length === 4
    ? `✅ Ayarlar kaydedildi! PIN: ${rawPin} aktif.`
    : '✅ Ayarlar kaydedildi!');
  renderHome();
  renderCalendar();
}

function clearPin() {
  document.getElementById('setting-pin').value = '';
  settings.userPin = '';
  saveData(STORAGE_KEYS.SETTINGS, settings);
  showToast('🔓 PIN kaldırıldı, uygulama kilitsiz.');
}

// ─── DATA EXPORT / DELETE ────────────────────────────────────
function exportData() {
  const data = { settings, logs, periods, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `lunacycle-export-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Veriler dışa aktarıldı!');
}

function confirmDeleteAll() {
  const modal = document.getElementById('modal-overlay');
  modal.style.display = 'flex';
  document.getElementById('modal-title').textContent = '⚠️ Tüm Verileri Sil';
  document.getElementById('modal-body').textContent  = 'Tüm kayıtlarınız, döngü geçmişiniz ve ayarlarınız kalıcı olarak silinecek. Bu işlem geri alınamaz!';
  document.getElementById('modal-confirm-btn').onclick = () => {
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.PERIODS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    logs = {}; periods = [];
    settings = { cycleLength:28, periodLength:5, lutealLength:14, lastPeriod:null, goal:'track' };
    closeModal();
    loadSettings();
    renderHome();
    renderCalendar();
    renderLogHistory();
    showToast('🗑️ Tüm veriler silindi.');
  };
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ─── NAVIGATION ──────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.getElementById('nav-' + name)?.classList.add('active');

  // Render page-specific content
  if (name === 'home')     renderHome();
  if (name === 'calendar') renderCalendar();
  if (name === 'log')      renderLogHistory();
  if (name === 'insights') renderInsights();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  // Scroll to top
  document.getElementById('main-content').scrollTo(0, 0);
}

// ─── TOAST ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── MOBILE NAV ──────────────────────────────────────────────
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page) showPage(page);
  });
});

// Close sidebar on outside click
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('mobile-menu-btn');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
    sidebar.classList.remove('open');
  }
});

// ─── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPin();
  loadSettings();
  initLogForm();
  initWaterTracker();

  if (!settings.lastPeriod) {
    setTimeout(() => {
      showToast('👋 Başlamak için son regl tarihinizi Ayarlar\'a girin!');
    }, 800);
  }
});


/* ============================================================
   YENİ ÖZELLİKLER – PIN, Su Tak., Motivasyon, İpuçları
   ============================================================ */

// ─── PIN LOCK ───────────────────────────────────────────────
let pinBuffer = '';

function initPin() {
  const pin = settings.userPin;
  const overlay = document.getElementById('pin-overlay');
  if (!pin || pin.length < 4) {
    overlay.classList.add('hidden');
    renderHome();
    renderCalendar();
    return;
  }
  overlay.classList.remove('hidden');
  document.getElementById('pin-subtitle').textContent = `Merhaba ${settings.userName || 'Nazlı'}! PIN'inizi girin 💕`;
  pinBuffer = '';
  updatePinDots();
}


function pinInput(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) {
    setTimeout(() => checkPin(), 150);
  }
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function skipPin() {
  document.getElementById('pin-overlay').classList.add('hidden');
  renderHome();
  renderCalendar();
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('dot-' + i);
    dot.classList.remove('filled', 'error');
    if (i < pinBuffer.length) dot.classList.add('filled');
  }
}

function checkPin() {
  if (pinBuffer === settings.userPin) {
    document.getElementById('pin-overlay').classList.add('hidden');
    renderHome();
    renderCalendar();
    showToast(`💕 Hoş geldin, ${settings.userName || 'Nazlı'}!`);
  } else {
    // Wrong PIN
    for (let i = 0; i < 4; i++) {
      document.getElementById('dot-' + i).classList.add('error');
    }
    document.getElementById('pin-subtitle').textContent = '❌ Yanlış PIN! Tekrar deneyin.';
    setTimeout(() => {
      pinBuffer = '';
      updatePinDots();
      document.getElementById('pin-subtitle').textContent = 'PIN\'inizi girin 💕';
    }, 900);
  }
}

function lockApp() {
  if (!settings.userPin || settings.userPin.length < 4) {
    showToast('⚠️ Ayarlar\'dan önce PIN oluşturun!');
    showPage('settings');
    return;
  }
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-subtitle').textContent = `Hoş geldin, ${settings.userName || 'Nazlı'}! PIN'inizi girin 💕`;
  document.getElementById('pin-overlay').classList.remove('hidden');
}

// ─── WATER TRACKER ──────────────────────────────────────────
const WATER_TIPS = [
  'Harika! 8 bardağın tamamını içtin! 🌟',
  '6-7 bardak çok iyi gidiyorsun! 💧',
  'Yarı yoldayız, devam et! 💧',
  'Henüz az, su içmeyi unutma! 💧',
  'Bugün henüz su içmediniz. İlk bardağı içme zamanı! 💧',
];

function initWaterTracker() {
  // Reset if new day
  const today = todayStr();
  if (!settings.waterToday || settings.waterToday.date !== today) {
    settings.waterToday = { date: today, cups: 0 };
    saveData(STORAGE_KEYS.SETTINGS, settings);
  }
  renderWaterTracker();
}

function renderWaterTracker() {
  const cups = settings.waterToday?.cups || 0;
  const container = document.getElementById('water-cups');
  if (!container) return;

  container.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const btn = document.createElement('button');
    btn.className = 'water-cup' + (i < cups ? ' filled' : '');
    btn.textContent = i < cups ? '💧' : '🫙';
    btn.title = i < cups ? `Bardak ${i+1} - İçildi` : `Bardak ${i+1} - Tıkla`;
    btn.onclick = () => toggleWaterCup(i);
    container.appendChild(btn);
  }

  const pct = (cups / 8) * 100;
  document.getElementById('water-bar-fill').style.width = pct + '%';
  document.getElementById('water-goal-badge').textContent = `${cups} / 8 bardak`;

  let tipIdx = cups === 8 ? 0 : cups >= 6 ? 1 : cups >= 4 ? 2 : cups >= 1 ? 3 : 4;
  document.getElementById('water-tip').textContent = WATER_TIPS[tipIdx];
}

function toggleWaterCup(idx) {
  const cups = settings.waterToday?.cups || 0;
  // If clicking filled cup → reset to that cup-1; if empty → fill up to that cup+1
  const newCups = idx < cups ? idx : idx + 1;
  settings.waterToday = { date: todayStr(), cups: newCups };
  saveData(STORAGE_KEYS.SETTINGS, settings);
  renderWaterTracker();
  if (newCups === 8) showToast('🎉 Günlük su hedefinizi tamamladınız!');
}

// ─── MOTIVATION QUOTES ──────────────────────────────────────
const MOTIVATIONS = {
  menstrual: [
    { icon: '🌸', text: 'Kendinize şefkatle yaklaşın. Vücudunuz muúze bir iş çıkarıyor.' },
    { icon: '🌙', text: 'Bu dönem geliyor ve geliyor. Siz buçok güçlüsünüz.' },
    { icon: '🤍', text: 'Isı uygulayın, bir fincan bitki çayı yapın ve kendinizi şarlındırın.' },
    { icon: '💧', text: 'Bol su içmeyi unutmayın. Vücudunuz şimdi daha fazlasına ihtiyaç duyuyor.' },
  ],
  follicular: [
    { icon: '✨', text: 'Enerjiniz yükseliyor! Bu dönem yeni şeylere başlamak için muhteşem.' },
    { icon: '🌸', text: 'Foliküler faz sizinle — yaratıcılığ ve enerji zirvede!' },
    { icon: '💪', text: 'Bugün kendinizi çok güçlü hissedeceksiniz. İyi ki varsınız!' },
  ],
  'fertile-pre': [
    { icon: '🔥', text: 'Fertil dönemdesiniz! Vücudunuz mucizevi bir yolculukta.' },
    { icon: '🦋', text: 'Bu günlerde özellikle kendinize dikkat edin — hormonal dengeniz değişiyor.' },
    { icon: '🌟', text: 'Kendinize özel zaman ayırın. Siz bunu hak ediyorsunuz!' },
  ],
  ovulation: [
    { icon: '🥊', text: 'Bugün yumurtlama gününüz! Vücudunuz olağanüstü bir performans gösteriyor.' },
    { icon: '⚡', text: 'Enerji ve karizma zirvede! Bugün her şeyi başarabilirsiniz.' },
    { icon: '🌸', text: 'Vücudunuzun ritmine güvenin. Her şey mükemmel zamanlamayla oluyor.' },
  ],
  'fertile-post': [
    { icon: '🌙', text: 'Yumurtlama bitti — şimdi biraz dinlenme zamanı.' },
    { icon: '🧘', text: 'Nefes eg zersizleri ve meditasyon bu dönemde harika hissettiriyor.' },
    { icon: '💕', text: 'Kendinize iyi bakın. Her gün yeni bir başlangıçtır.' },
  ],
  luteal: [
    { icon: '🌙', text: 'Lüteal faz hassaslık getirebilir. Duygularınız geçerli ve değerli.' },
    { icon: '🧠', text: 'PMS belirtileri yaşıyorsanız bu normal. Kendinize karşı nazik olun.' },
    { icon: '🟣', text: 'Şekerleme isteği normal — biraz bitter çikolata zararı yok 😊' },
    { icon: '✨', text: 'Az sonra yeni bir döngü başlıyor. Her şey geçici.' },
  ],
};

function renderMotivation(phase) {
  const list = MOTIVATIONS[phase] || MOTIVATIONS.follicular;
  const item = list[Math.floor(Math.random() * list.length)];
  document.getElementById('motivation-icon').textContent = item.icon;
  document.getElementById('motivation-text').textContent = item.text;
}

// ─── PHASE TIPS ──────────────────────────────────────────────
const PHASE_TIPS = {
  menstrual: {
    nutrition: 'Kaybedilen demiri yerine koymak için demir açısından zengin gıdalar tercih edin. Kramp için magnezyum çok iyi gelir.',
    foods: ['🥩 Kırmızı Et', '🥦 Ispanak', '🌿 Mercimek', '🥫 Muz', '🌶️ Zencefil Çayı', '🥜 Fındık'],
    exercise: 'Yoğun egzersizden kaçının. Hafif hareketler, yürüyüş ve yoga krampı azaltmaya yardımcı olur.',
    activities: ['🧘 Restoratif Yoga', '🚶‍♀️ Hafif Yürüyüş', '🏥 Ger me', '💤 Dinlenme'],
  },
  follicular: {
    nutrition: 'Vücudunuz folikül gelişimi için besin istiyor. Omega-3 ve antioksidan z engin gıdalar harika seçim.',
    foods: ['🥑 Avokado', '🐟 Somon', '🥦 Brokoli', '🍳 Yumurta', '🫐 Yaban Mersini', '🌰 Ceviz'],
    exercise: 'Enerji yüksek! Kardiyo ve güç antrenmanı için en iyi dönem. Yeni bir sporla deneyin.',
    activities: ['🏋️ Güç Antrenam an', '🏃 Kardiyo', '🚴 Bisiklet', '💃 Dans'],
  },
  'fertile-pre': {
    nutrition: 'Enerji ve libido desteklemek için çinko, E vitamini ve sağlıklı yağlara odaklanın.',
    foods: ['🤞‍♂️ Balkabak Çekirdeği', '🥜 Badem', '🌍 Zeytin Yağı', '🥭 Ahududu', '👌 Kabak'],
    exercise: 'Yoğunluğu artırabilirsiniz. Hı zlı yürüyüş, yoga ve dans enerjinizi çıkaracak.',
    activities: ['🧘 Güç Yogası', '🏃 Koşu', '💃 Zumba', '🏘️ Pilates'],
  },
  ovulation: {
    nutrition: 'En verimli gününüz! Hafif ve enerji veren gıdalar tercih edin. Antiinflamatuar besinler harika.',
    foods: ['🍋 Limon', '🥬 Çilek', '🥑 Avokado', '🥗 Quinoa', '🥬 Ispanak', '🍉 Karpuz'],
    exercise: 'Enerji ve güç zirvede! HIIT, koşu veya yoğun antrenman çok uygun.',
    activities: ['🏃 HIIT', '🚴 Spin', '🍏 Koşu', '🏊 Yüzme'],
  },
  'fertile-post': {
    nutrition: 'Progesteronu destekleyen gıdalar tüketin. B6 vitamini ve magnezyum önemli.',
    foods: ['🥗 Tavuk', '🥒 Bezelye', '🍌 Muz', '🥐 Tam Buğday', '🥚 Patlıcan'],
    exercise: 'Orta yoğunlukta egzersiz idealdir. Pilates ve yoga harika.',
    activities: ['🏘️ Pilates', '🧘 Yoga', '🚶 Yürüyüş', '🤺 Esneme'],
  },
  luteal: {
    nutrition: 'PMS semptomlarını azaltmak için magnezyum, B vitamini ve kompleks karbonhidrat alın.',
    foods: ['🍫 Bitter Çiko la ta', '🥦 ×spanak', '🍠 Tatlı Patates', '🥑 Avokado', '🍌 Muz', '🥜 Fındık'],
    exercise: 'Hafif ve rahatlatıcı hareketler tercih edin. Yoğun antrenman hormonal dengesizliği artırabilir.',
    activities: ['🧘 Yin Yoga', '🚶 Yürüyüş', '💤 Meditasyon', '🧑‍🦱 Nefes Eg.'],
  },
};

function renderPhaseTips(phase) {
  const tips = PHASE_TIPS[phase] || PHASE_TIPS.follicular;

  document.getElementById('tip-nutrition-text').textContent = tips.nutrition;
  const foodsEl = document.getElementById('tip-foods');
  foodsEl.innerHTML = tips.foods.map(f => `<span class="tip-tag food-tag">${f}</span>`).join('');

  document.getElementById('tip-exercise-text').textContent = tips.exercise;
  const actsEl = document.getElementById('tip-activities');
  actsEl.innerHTML = tips.activities.map(a => `<span class="tip-tag activity-tag">${a}</span>`).join('');
}

// ─── BROWSER NOTIFICATIONS ──────────────────────────────────
async function requestNotifications() {
  if (!('Notification' in window)) {
    showToast('⚠️ Tarayıcınız bildirimleri desteklemiyor.');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('✅ Bildirimler zaten aktif!');
    document.getElementById('notif-btn').classList.add('active');
    scheduleNotifications();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    document.getElementById('notif-btn').classList.add('active');
    showToast('🔔 Bildirimler aktif! Fertil dönemde sizi uyaracaz.');
    scheduleNotifications();
  } else {
    showToast('❌ Bildirim izni verilmedi.');
  }
}

function scheduleNotifications() {
  const cd = getCycleData();
  if (!cd || Notification.permission !== 'granted') return;

  if (cd.phase === 'ovulation') {
    new Notification('🥊 LunaCycle – Yumurtlama Günü!', {
      body: `Bugün yumurtlama gününüz ${settings.userName}! ${
        settings.goal === 'avoid' ? 'Lütfen korunun.' :
        settings.goal === 'conceive' ? 'Hamile kalmak için en ideal gün!' :
        'Hamilelik riski çok yüksek.'}`,
      icon: '🌙',
    });
  } else if (cd.phase === 'fertile-pre' && cd.daysToOvulation <= 2) {
    new Notification('🔥 LunaCycle – Yumurtlama Yaklışıyor!', {
      body: `${settings.userName}, ${cd.daysToOvulation} gün sonra yumurtlama bekleniyor. Fertil dönemdesiniz!`,
      icon: '🌙',
    });
  }
}

}
