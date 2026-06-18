/* ===========================================================================
 * Workout Logger — client logic
 * Vanilla JS + Supabase (auth + Postgres with Row Level Security).
 * Mobile-first; optimized for fast one-handed logging at the gym.
 * =========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------- *
   * Config & Supabase client
   * ----------------------------------------------------------------------- */
  var cfg = window.STRENGTH_CONFIG || {};
  function configured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      String(cfg.SUPABASE_URL).indexOf('YOUR_SUPABASE') === -1 &&
      String(cfg.SUPABASE_ANON_KEY).indexOf('YOUR_SUPABASE') === -1;
  }
  var sb = null;

  /* ----------------------------------------------------------------------- *
   * Small helpers
   * ----------------------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function show(viewId) {
    ['view-setup', 'view-auth', 'view-app'].forEach(function (v) {
      var n = $(v); if (n) n.hidden = (v !== viewId);
    });
  }
  function overlay(id, on) { var n = $(id); if (n) n.hidden = !on; }
  function fmtW(w) {
    if (w == null || w === '') return '–';
    var n = Number(w);
    return (n % 1 === 0) ? String(n) : String(n);
  }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function parseDate(d) { var p = String(d).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(d) { var x = parseDate(d); return MONTHS[x.getMonth()] + ' ' + x.getDate(); }
  function fmtDateFull(d) { var x = parseDate(d); return MONTHS[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear(); }
  function monthLabel(d) { var x = parseDate(d); return MONTHS[x.getMonth()] + ' ' + x.getFullYear(); }
  function maxInt(text, dflt) {
    var nums = String(text || '').match(/\d+/g);
    if (!nums) return dflt;
    return nums.reduce(function (a, b) { return Math.max(a, +b); }, 0) || dflt;
  }
  function restSeconds(text) {
    var n = String(text || '').match(/\d+/);
    return n ? (+n[0]) * 60 : 0;
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  /* ----------------------------------------------------------------------- *
   * App state
   * ----------------------------------------------------------------------- */
  var state = {
    user: null,
    profile: { weight_unit: 'lb' },
    exercises: [],          // full library (seeds + user)
    exById: {},
    tab: 'templates',
    active: null            // active session model (see startSession)
  };
  function unit() { return state.profile.weight_unit || 'lb'; }
  function wStep() { return unit() === 'kg' ? 1.25 : 2.5; }

  var STARTERS = [
    { name: 'Full Body Split', phase: 'Month 1', items: [
      { name: 'Dumbbell Bench Press', section: 'UPPER BODY' },
      { name: 'Dumbbell Overhead Press', section: 'UPPER BODY' },
      { name: 'Cable Chest Flys', section: 'UPPER BODY' },
      { name: 'Bent Over Tricep Kickbacks', section: 'UPPER BODY' },
      { name: 'Cable Tricep Extension', section: 'UPPER BODY' },
      { name: 'Hanging Leg Raises', section: 'CORE' },
      { name: 'Plank', section: 'CORE' }
    ] },
    { name: 'Upper / Core Split', phase: 'Month 1', items: [
      { name: 'Dumbbell Bench Press', section: 'UPPER BODY' },
      { name: 'Cable Chest Flys', section: 'UPPER BODY' },
      { name: 'Dumbbell Overhead Press', section: 'UPPER BODY' },
      { name: 'Front to Lateral Raise', section: 'UPPER BODY' },
      { name: 'Cable Tricep Extension', section: 'UPPER BODY' },
      { name: 'Hanging Leg Raises', section: 'CORE' },
      { name: 'Hollow Body Hold', section: 'CORE' },
      { name: 'Russian Twist', section: 'CORE' },
      { name: 'Side Plank', section: 'CORE' }
    ] }
  ];
  var M1 = { target_sets: '3', target_reps: '10-15', target_rest: '2-3 min' };

  /* ----------------------------------------------------------------------- *
   * Auth
   * ----------------------------------------------------------------------- */
  var authMode = 'signin';
  function authMsg(text, kind) {
    var m = $('auth-msg');
    m.textContent = text || '';
    m.className = 'msg' + (text ? ' show ' + (kind || '') : '');
  }
  function setAuthMode(mode) {
    authMode = mode;
    $('auth-tag').textContent = mode === 'signin' ? 'Sign in to your account' : 'Create your account';
    $('auth-submit').textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
    $('auth-switch').textContent = mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in';
    $('auth-password').setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
    authMsg('');
  }
  function wireAuth() {
    $('auth-switch').addEventListener('click', function () {
      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    });
    $('auth-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('auth-email').value.trim();
      var pw = $('auth-password').value;
      var btn = $('auth-submit'); btn.disabled = true;
      var done = function () { btn.disabled = false; };
      if (authMode === 'signup') {
        sb.auth.signUp({ email: email, password: pw }).then(function (r) {
          done();
          if (r.error) return authMsg(r.error.message, 'err');
          if (r.data && r.data.session) return; // auto-confirmed → onAuthStateChange boots
          authMsg('Account created. Check your email to confirm, then sign in.', 'ok');
          setAuthMode('signin');
        });
      } else {
        sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
          done();
          if (r.error) return authMsg(r.error.message, 'err');
        });
      }
    });
  }
  function signOut() { sb.auth.signOut(); }

  /* ----------------------------------------------------------------------- *
   * Data layer
   * ----------------------------------------------------------------------- */
  function ensureProfile() {
    return sb.from('profiles').select('weight_unit').eq('id', state.user.id).maybeSingle()
      .then(function (r) {
        if (r.data) { state.profile.weight_unit = r.data.weight_unit; return; }
        return sb.from('profiles').insert({ id: state.user.id, weight_unit: 'lb' }).then(function () {});
      });
  }
  function setUnit(u) {
    state.profile.weight_unit = u;
    return sb.from('profiles').update({ weight_unit: u }).eq('id', state.user.id);
  }
  function loadExercises() {
    return sb.from('exercises').select('id,user_id,name,muscle_group,equipment,description')
      .order('name').then(function (r) {
        state.exercises = r.data || [];
        state.exById = {};
        state.exercises.forEach(function (e) { state.exById[e.id] = e; });
      });
  }
  function listTemplates() {
    return sb.from('templates').select('id,name,phase,template_exercises(count)')
      .order('created_at').then(function (r) { return r.data || []; });
  }
  function getTemplate(id) {
    return sb.from('templates')
      .select('id,name,phase,template_exercises(id,section,position,target_sets,target_reps,target_rest,exercise_id)')
      .eq('id', id).single().then(function (r) {
        var t = r.data;
        if (t && t.template_exercises) t.template_exercises.sort(function (a, b) { return a.position - b.position; });
        return t;
      });
  }
  function inProgressSession() {
    return sb.from('sessions').select('id,performed_on,template_id,templates(name)')
      .is('finished_at', null).order('started_at', { ascending: false }).limit(1)
      .then(function (r) { return (r.data && r.data[0]) || null; });
  }
  function lastTimeFor(exId) {
    return sb.from('sessions')
      .select('performed_on,set_logs!inner(set_number,weight,reps,exercise_id)')
      .not('finished_at', 'is', null)
      .eq('set_logs.exercise_id', exId)
      .order('performed_on', { ascending: false }).limit(1)
      .then(function (r) {
        var s = r.data && r.data[0];
        if (!s) return { date: null, byNum: {} };
        var byNum = {};
        (s.set_logs || []).forEach(function (sl) { byNum[sl.set_number] = sl; });
        return { date: s.performed_on, byNum: byNum };
      });
  }

  /* ----------------------------------------------------------------------- *
   * Boot
   * ----------------------------------------------------------------------- */
  function boot() {
    if (!configured()) { show('view-setup'); return; }
    if (!window.supabase) { show('view-setup'); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    wireAuth(); setAuthMode('signin'); wireApp();

    sb.auth.onAuthStateChange(function (_evt, session) {
      var u = session && session.user;
      if (u && (!state.user || state.user.id !== u.id)) { state.user = u; enterApp(); }
      else if (!u && state.user) { state.user = null; show('view-auth'); }
    });
    sb.auth.getSession().then(function (r) {
      var u = r.data && r.data.session && r.data.session.user;
      if (u) { state.user = u; enterApp(); } else { show('view-auth'); }
    });
  }

  function enterApp() {
    show('view-app');
    Promise.all([ensureProfile(), loadExercises()]).then(function () {
      return ensureStarters();
    }).then(function () {
      switchTab('templates');
      renderTemplatesTab();
    });
  }

  function ensureStarters() {
    var flag = 'wl_seeded_' + state.user.id;
    if (localStorage.getItem(flag)) return Promise.resolve();
    return listTemplates().then(function (ts) {
      localStorage.setItem(flag, '1');
      if (ts.length) return;
      return createStarterTemplates();
    });
  }
  function createStarterTemplates() {
    var chain = Promise.resolve();
    STARTERS.forEach(function (tpl) {
      chain = chain.then(function () {
        return sb.from('templates').insert({ user_id: state.user.id, name: tpl.name, phase: tpl.phase })
          .select('id').single().then(function (r) {
            if (!r.data) return;
            var rows = [];
            tpl.items.forEach(function (it, i) {
              var ex = state.exercises.filter(function (e) { return e.name === it.name; })[0];
              if (!ex) return;
              rows.push({
                template_id: r.data.id, exercise_id: ex.id, user_id: state.user.id,
                section: it.section, position: i + 1,
                target_sets: M1.target_sets, target_reps: M1.target_reps, target_rest: M1.target_rest
              });
            });
            if (rows.length) return sb.from('template_exercises').insert(rows);
          });
      });
    });
    return chain;
  }

  /* ----------------------------------------------------------------------- *
   * Tabs & top-level wiring
   * ----------------------------------------------------------------------- */
  function switchTab(tab) {
    state.tab = tab;
    ['templates', 'history', 'exercises'].forEach(function (t) {
      $('tab-' + t).hidden = (t !== tab);
    });
    document.querySelectorAll('.tabbtn').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false');
    });
    if (tab === 'history') renderHistory();
    if (tab === 'exercises') renderExercises();
    if (tab === 'templates') renderTemplatesTab();
    window.scrollTo(0, 0);
  }

  function wireApp() {
    document.querySelectorAll('.tabbtn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    $('open-settings').addEventListener('click', openSettings);
    $('freeform-btn').addEventListener('click', function () { startSession(null); });
    $('new-template-btn').addEventListener('click', function () { openTemplateEditor(null); });
    $('add-exercise-btn').addEventListener('click', openExerciseForm);
    $('ex-search').addEventListener('input', renderExercises);

    $('session-back').addEventListener('click', function () { overlay('view-session', false); renderTemplatesTab(); });
    $('session-finish').addEventListener('click', finishActive);
    $('progress-back').addEventListener('click', function () { overlay('view-progress', false); });
    $('detail-back').addEventListener('click', function () { overlay('view-detail', false); });

    var body = $('session-body');
    body.addEventListener('click', onSessionClick);
    body.addEventListener('change', onSessionInput);
  }

  /* ----------------------------------------------------------------------- *
   * Templates tab (home)
   * ----------------------------------------------------------------------- */
  function renderTemplatesTab() {
    inProgressSession().then(function (ip) {
      var slot = $('resume-slot');
      if (ip) {
        slot.innerHTML =
          '<div class="resume-banner"><div class="grow">Workout in progress' +
          (ip.templates ? ' · ' + esc(ip.templates.name) : '') + '</div>' +
          '<button id="resume-btn">Resume</button></div>';
        $('resume-btn').addEventListener('click', function () { resumeSession(ip.id); });
      } else { slot.innerHTML = ''; }
    });
    listTemplates().then(function (ts) {
      var box = $('templates-list');
      if (!ts.length) {
        box.innerHTML = '<div class="empty"><div class="big">🗂️</div>No templates yet.<br>Create one, or start a freeform session.</div>';
        return;
      }
      box.innerHTML = ts.map(function (t) {
        var count = (t.template_exercises && t.template_exercises[0] && t.template_exercises[0].count) || 0;
        return '<div class="card"><div class="row"><div class="grow">' +
          '<div style="font-size:19px;font-weight:700">' + esc(t.name) + '</div>' +
          '<div class="muted" style="font-size:14px;margin-top:3px">' +
          (t.phase ? '<span class="pill">' + esc(t.phase) + '</span> &nbsp;' : '') +
          count + ' exercise' + (count === 1 ? '' : 's') + '</div></div>' +
          '<button class="iconbtn" data-edit="' + t.id + '" title="Edit">✏️</button></div>' +
          '<div style="margin-top:12px"><button class="btn" data-start="' + t.id + '">Start workout</button></div></div>';
      }).join('');
      box.querySelectorAll('[data-start]').forEach(function (b) {
        b.addEventListener('click', function () { startSession(+b.getAttribute('data-start')); });
      });
      box.querySelectorAll('[data-edit]').forEach(function (b) {
        b.addEventListener('click', function () { openTemplateEditor(+b.getAttribute('data-edit')); });
      });
    });
  }

  /* ----------------------------------------------------------------------- *
   * Active session
   * ----------------------------------------------------------------------- */
  // Build the in-memory model: list of { exId, name, section, target, sets:[{set_number,weight,reps,completed,saved}], last:{date,byNum} }
  function startSession(templateId) {
    var p = templateId
      ? getTemplate(templateId)
      : Promise.resolve(null);
    p.then(function (tpl) {
      return sb.from('sessions').insert({
        user_id: state.user.id, template_id: templateId || null
      }).select('id,performed_on,template_id').single().then(function (r) {
        return buildActive(r.data, tpl, []);
      });
    }).then(openActive);
  }

  function resumeSession(sessionId) {
    sb.from('sessions').select('id,performed_on,template_id,templates(name)')
      .eq('id', sessionId).single().then(function (r) {
        var s = r.data;
        var tplP = s.template_id ? getTemplate(s.template_id) : Promise.resolve(null);
        var logsP = sb.from('set_logs').select('exercise_id,set_number,weight,reps,completed').eq('session_id', sessionId);
        return Promise.all([tplP, logsP]).then(function (res) {
          return buildActive(s, res[0], (res[1].data || []));
        });
      }).then(openActive);
  }

  function buildActive(session, tpl, existingLogs) {
    var exList = [];
    var logsBy = {}; // exId -> {setn -> log}
    existingLogs.forEach(function (l) {
      (logsBy[l.exercise_id] = logsBy[l.exercise_id] || {})[l.set_number] = l;
    });

    function addExercise(exId, section, target) {
      var ex = state.exById[exId] || { id: exId, name: 'Exercise' };
      var nSets = target ? maxInt(target.target_sets, 3) : 3;
      var saved = logsBy[exId] || {};
      var maxSaved = Object.keys(saved).reduce(function (a, k) { return Math.max(a, +k); }, 0);
      nSets = Math.max(nSets, maxSaved);
      var sets = [];
      for (var i = 1; i <= nSets; i++) {
        var s = saved[i];
        sets.push({ set_number: i,
          weight: s && s.weight != null ? s.weight : '',
          reps: s && s.reps != null ? s.reps : '',
          completed: !!(s && s.completed) });
      }
      exList.push({ exId: exId, name: ex.name, section: section || null, target: target || null,
        rest: target ? restSeconds(target.target_rest) : 0, sets: sets, last: { date: null, byNum: {} } });
    }

    if (tpl && tpl.template_exercises) {
      tpl.template_exercises.forEach(function (te) {
        addExercise(te.exercise_id, te.section, te);
      });
    } else {
      // freeform: seed from any existing logs (resume), else empty
      Object.keys(logsBy).forEach(function (exId) { addExercise(+exId, null, null); });
    }

    var model = { session: session, tpl: tpl, exercises: exList };
    // load last-time hints in parallel (non-blocking refresh)
    var ids = exList.map(function (e) { return e.exId; });
    Promise.all(ids.map(function (id) { return lastTimeFor(id); })).then(function (res) {
      res.forEach(function (lt, i) { exList[i].last = lt; });
      if (state.active === model) renderActive();
    });
    return model;
  }

  function openActive(model) {
    state.active = model;
    var s = model.session;
    $('session-title').textContent = model.tpl ? model.tpl.name : 'Freeform session';
    $('session-sub').textContent = fmtDateFull(s.performed_on);
    overlay('view-session', true);
    window.scrollTo(0, 0);
    renderActive();
  }

  function renderActive() {
    var m = state.active; if (!m) return;
    var html = '';
    var lastSection = '__none__';
    m.exercises.forEach(function (ex, idx) {
      if (ex.section && ex.section !== lastSection) {
        html += '<div class="section-head">' + esc(ex.section) + '</div>';
        lastSection = ex.section;
      } else if (!ex.section && lastSection !== '__none__') {
        lastSection = '__none__';
      }
      html += exerciseCardHtml(ex, idx);
    });
    html += '<div style="margin-top:6px"><button class="btn secondary" id="session-add-ex">+ Add exercise</button></div>';
    if (m.session.notes != null || true) {
      html += '<label class="field" style="margin-top:16px"><span>Session notes</span>' +
        '<textarea id="session-notes" rows="2" placeholder="How did it feel?">' + esc(m.session.notes || '') + '</textarea></label>';
    }
    var body = $('session-body');
    body.innerHTML = html;
    $('session-add-ex').addEventListener('click', function () {
      pickExercise(function (ex) { addExerciseToActive(ex); });
    });
    var notes = $('session-notes');
    if (notes) notes.addEventListener('change', function () {
      m.session.notes = notes.value;
      sb.from('sessions').update({ notes: notes.value }).eq('id', m.session.id);
    });
  }

  function exerciseCardHtml(ex, idx) {
    var allset = ex.sets.length > 0 && ex.sets.every(function (s) { return s.completed; });
    var target = ex.target ? (ex.target.target_sets || '?') + ' × ' + (ex.target.target_reps || '?') : '';
    var rows = ex.sets.map(function (s) { return setRowHtml(idx, s, ex.last.byNum[s.set_number]); }).join('');
    return '<div class="ex-card' + (allset ? ' allset' : '') + '" data-card="' + idx + '">' +
      '<div class="row"><div class="grow"><div class="exname">' + esc(ex.name) + '</div>' +
      (target ? '<div class="extarget">Target ' + esc(target) + (ex.target.target_rest ? ' · rest ' + esc(ex.target.target_rest) : '') + '</div>' : '') +
      '</div><button class="iconbtn" data-prog="' + ex.exId + '" title="Progress">📈</button></div>' +
      rows +
      '<div style="margin-top:8px"><button class="btn ghost" data-addset="' + idx + '">+ Add set</button></div>' +
      '</div>';
  }

  function setRowHtml(exIdx, s, last) {
    var hint = last ? ('last: ' + fmtW(last.weight) + (last.reps != null ? ' × ' + last.reps : '')) : '';
    var beat = (last && s.weight !== '' && s.weight != null && Number(s.weight) > Number(last.weight));
    var w = (s.weight === '' || s.weight == null) ? '' : s.weight;
    var r = (s.reps === '' || s.reps == null) ? '' : s.reps;
    return '<div class="lasthint">' + (hint ? esc(hint) + (beat ? ' <span class="beat">▲ PR</span>' : '') : '') + '</div>' +
      '<div class="setrow" data-ex="' + exIdx + '" data-setn="' + s.set_number + '">' +
        '<div class="setn num">' + s.set_number + '</div>' +
        '<div class="cell"><span class="steplabel">Weight (' + unit() + ')</span>' +
          '<div class="stepper"><button data-act="w-" aria-label="decrease weight">−</button>' +
          '<input data-f="weight" inputmode="decimal" value="' + esc(w) + '" />' +
          '<button data-act="w+" aria-label="increase weight">+</button></div></div>' +
        '<div class="cell"><span class="steplabel">Reps</span>' +
          '<div class="stepper"><button data-act="r-" aria-label="decrease reps">−</button>' +
          '<input data-f="reps" inputmode="numeric" value="' + esc(r) + '" />' +
          '<button data-act="r+" aria-label="increase reps">+</button></div></div>' +
        '<div class="donebox' + (s.completed ? ' on' : '') + '" data-act="done" role="checkbox" aria-checked="' +
          (s.completed ? 'true' : 'false') + '" tabindex="0">✓</div>' +
      '</div>';
  }

  function activeSet(exIdx, setn) {
    var ex = state.active.exercises[exIdx];
    for (var i = 0; i < ex.sets.length; i++) if (ex.sets[i].set_number === setn) return { ex: ex, s: ex.sets[i] };
    return null;
  }

  function onSessionClick(e) {
    var prog = e.target.closest('[data-prog]');
    if (prog) { openProgress(+prog.getAttribute('data-prog')); return; }
    var addset = e.target.closest('[data-addset]');
    if (addset) { addSetTo(+addset.getAttribute('data-addset')); return; }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    var row = act.closest('.setrow'); if (!row) return;
    var exIdx = +row.getAttribute('data-ex'), setn = +row.getAttribute('data-setn');
    var ref = activeSet(exIdx, setn); if (!ref) return;
    var kind = act.getAttribute('data-act');
    if (kind === 'done') {
      ref.s.completed = !ref.s.completed;
      act.classList.toggle('on', ref.s.completed);
      act.setAttribute('aria-checked', ref.s.completed ? 'true' : 'false');
      refreshCardState(exIdx);
      saveSet(ref.ex, ref.s);
      if (ref.s.completed && ref.ex.rest) startRest(ref.ex.rest, ref.ex.name);
      return;
    }
    // steppers
    var input = row.querySelector(kind[0] === 'w' ? '[data-f="weight"]' : '[data-f="reps"]');
    if (kind === 'w-' || kind === 'w+') {
      var cur = parseFloat(input.value) || 0;
      cur = Math.max(0, Math.round((cur + (kind === 'w+' ? wStep() : -wStep())) * 100) / 100);
      input.value = cur; ref.s.weight = cur;
    } else {
      var cr = parseInt(input.value, 10) || 0;
      cr = Math.max(0, cr + (kind === 'r+' ? 1 : -1));
      input.value = cr; ref.s.reps = cr;
    }
    refreshHint(row, ref);
    saveSetDebounced(ref.ex, ref.s);
  }

  function onSessionInput(e) {
    var input = e.target.closest('[data-f]'); if (!input) return;
    var row = input.closest('.setrow'); if (!row) return;
    var exIdx = +row.getAttribute('data-ex'), setn = +row.getAttribute('data-setn');
    var ref = activeSet(exIdx, setn); if (!ref) return;
    var f = input.getAttribute('data-f');
    var val = input.value.trim();
    if (f === 'weight') ref.s.weight = (val === '' ? '' : (parseFloat(val) || 0));
    else ref.s.reps = (val === '' ? '' : (parseInt(val, 10) || 0));
    refreshHint(row, ref);
    saveSet(ref.ex, ref.s);
  }

  function refreshHint(row, ref) {
    var last = ref.ex.last.byNum[ref.s.set_number];
    var hintEl = row.previousElementSibling;
    if (!hintEl || !hintEl.classList.contains('lasthint')) return;
    if (!last) { hintEl.innerHTML = ''; return; }
    var beat = ref.s.weight !== '' && ref.s.weight != null && Number(ref.s.weight) > Number(last.weight);
    hintEl.innerHTML = esc('last: ' + fmtW(last.weight) + (last.reps != null ? ' × ' + last.reps : '')) +
      (beat ? ' <span class="beat">▲ PR</span>' : '');
  }

  function refreshCardState(exIdx) {
    var ex = state.active.exercises[exIdx];
    var card = document.querySelector('.ex-card[data-card="' + exIdx + '"]');
    if (!card) return;
    var allset = ex.sets.length > 0 && ex.sets.every(function (s) { return s.completed; });
    card.classList.toggle('allset', allset);
  }

  function addSetTo(exIdx) {
    var ex = state.active.exercises[exIdx];
    var n = ex.sets.length ? ex.sets[ex.sets.length - 1].set_number + 1 : 1;
    ex.sets.push({ set_number: n, weight: '', reps: '', completed: false });
    renderActive();
  }

  function addExerciseToActive(ex) {
    var m = state.active;
    // skip if already present
    if (m.exercises.some(function (e) { return e.exId === ex.id; })) return;
    m.exercises.push({ exId: ex.id, name: ex.name, section: null, target: null, rest: 0,
      sets: [{ set_number: 1, weight: '', reps: '', completed: false },
             { set_number: 2, weight: '', reps: '', completed: false },
             { set_number: 3, weight: '', reps: '', completed: false }],
      last: { date: null, byNum: {} } });
    lastTimeFor(ex.id).then(function (lt) {
      var added = m.exercises[m.exercises.length - 1];
      if (added) added.last = lt;
      if (state.active === m) renderActive();
    });
    renderActive();
  }

  function saveSet(ex, s) {
    if (!state.active) return;
    var hasData = (s.weight !== '' && s.weight != null) || (s.reps !== '' && s.reps != null) || s.completed;
    if (!hasData) return; // don't write empty rows
    sb.from('set_logs').upsert({
      session_id: state.active.session.id,
      exercise_id: ex.exId,
      user_id: state.user.id,
      set_number: s.set_number,
      weight: (s.weight === '' ? null : s.weight),
      reps: (s.reps === '' ? null : s.reps),
      completed: !!s.completed
    }, { onConflict: 'session_id,exercise_id,set_number' }).then(function (r) {
      if (r.error) console.warn('save set failed', r.error.message);
    });
  }
  var saveSetDebounced = debounce(function (ex, s) { saveSet(ex, s); }, 450);

  function finishActive() {
    var m = state.active; if (!m) return;
    sb.from('sessions').update({ finished_at: new Date().toISOString(), notes: m.session.notes || null })
      .eq('id', m.session.id).then(function () {
        stopRest();
        state.active = null;
        overlay('view-session', false);
        switchTab('history');
      });
  }

  /* ---- Rest timer ---- */
  var restState = { id: null, left: 0 };
  function startRest(seconds, name) {
    stopRest();
    restState.left = seconds;
    var box = document.createElement('div');
    box.className = 'resttimer'; box.id = 'resttimer';
    document.body.appendChild(box);
    function paint() {
      var mm = Math.floor(restState.left / 60), ss = restState.left % 60;
      box.innerHTML = '<span>⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss + '</span>' +
        '<button id="rest-skip">Skip</button>';
      $('rest-skip').addEventListener('click', stopRest);
    }
    paint();
    restState.id = setInterval(function () {
      restState.left--; if (restState.left <= 0) { stopRest(); return; } paint();
    }, 1000);
  }
  function stopRest() {
    if (restState.id) { clearInterval(restState.id); restState.id = null; }
    var b = $('resttimer'); if (b) b.remove();
  }

  /* ----------------------------------------------------------------------- *
   * History
   * ----------------------------------------------------------------------- */
  function renderHistory() {
    var box = $('history-list');
    box.innerHTML = '<div class="empty">Loading…</div>';
    sb.from('sessions')
      .select('id,performed_on,finished_at,templates(name),set_logs(exercise_id)')
      .not('finished_at', 'is', null)
      .order('performed_on', { ascending: false })
      .then(function (r) {
        var rows = r.data || [];
        if (!rows.length) {
          box.innerHTML = '<div class="empty"><div class="big">📅</div>No finished workouts yet.<br>Start one from the Workouts tab.</div>';
          return;
        }
        var html = '', curMonth = '';
        rows.forEach(function (s) {
          var ml = monthLabel(s.performed_on);
          if (ml !== curMonth) { html += '<div class="section-head">' + esc(ml) + '</div>'; curMonth = ml; }
          var exCount = {}, setCount = (s.set_logs || []).length;
          (s.set_logs || []).forEach(function (sl) { exCount[sl.exercise_id] = 1; });
          var nEx = Object.keys(exCount).length;
          html += '<button class="card tap" data-detail="' + s.id + '"><div class="row"><div class="grow">' +
            '<div style="font-weight:700">' + fmtDate(s.performed_on) +
            (s.templates ? ' · ' + esc(s.templates.name) : ' · Freeform') + '</div>' +
            '<div class="muted" style="font-size:14px;margin-top:2px">' + nEx + ' exercise' + (nEx === 1 ? '' : 's') +
            ', ' + setCount + ' set' + (setCount === 1 ? '' : 's') + '</div></div><div class="faint">›</div></div></button>';
        });
        box.innerHTML = html;
        box.querySelectorAll('[data-detail]').forEach(function (b) {
          b.addEventListener('click', function () { openDetail(+b.getAttribute('data-detail')); });
        });
      });
  }

  function openDetail(id) {
    overlay('view-detail', true);
    var body = $('detail-body'); body.innerHTML = '<div class="empty">Loading…</div>';
    sb.from('sessions')
      .select('performed_on,notes,templates(name),set_logs(exercise_id,set_number,weight,reps,completed)')
      .eq('id', id).single().then(function (r) {
        var s = r.data;
        $('detail-title').textContent = s.templates ? s.templates.name : 'Freeform session';
        $('detail-sub').textContent = fmtDateFull(s.performed_on);
        var byEx = {};
        (s.set_logs || []).forEach(function (sl) { (byEx[sl.exercise_id] = byEx[sl.exercise_id] || []).push(sl); });
        var html = '';
        Object.keys(byEx).forEach(function (exId) {
          var ex = state.exById[exId] || { name: 'Exercise' };
          var sets = byEx[exId].sort(function (a, b) { return a.set_number - b.set_number; });
          html += '<div class="ex-card"><div class="exname" style="margin-bottom:8px">' + esc(ex.name) + '</div>' +
            sets.map(function (st) {
              return '<div class="row" style="padding:4px 0"><div class="setn num" style="width:24px">' + st.set_number + '</div>' +
                '<div class="grow num">' + fmtW(st.weight) + ' ' + unit() + ' × ' + (st.reps != null ? st.reps : '–') + '</div>' +
                (st.completed ? '<span class="pill">done</span>' : '<span class="faint">skipped</span>') + '</div>';
            }).join('') + '</div>';
        });
        if (s.notes) html += '<div class="card"><div class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Notes</div>' + esc(s.notes) + '</div>';
        body.innerHTML = html || '<div class="empty">No sets logged.</div>';
      });
  }

  /* ----------------------------------------------------------------------- *
   * Exercise progress
   * ----------------------------------------------------------------------- */
  function openProgress(exId) {
    overlay('view-progress', true);
    var ex = state.exById[exId] || { name: 'Exercise' };
    $('progress-title').textContent = ex.name;
    $('progress-sub').textContent = ex.muscle_group || '';
    var body = $('progress-body'); body.innerHTML = '<div class="empty">Loading…</div>';
    sb.from('sessions')
      .select('performed_on,set_logs!inner(weight,reps,exercise_id)')
      .not('finished_at', 'is', null)
      .eq('set_logs.exercise_id', exId)
      .order('performed_on', { ascending: true })
      .then(function (r) {
        var sessions = r.data || [];
        var points = sessions.map(function (s) {
          var top = 0, vol = 0;
          (s.set_logs || []).forEach(function (sl) {
            var w = Number(sl.weight) || 0, reps = Number(sl.reps) || 0;
            if (w > top) top = w; vol += w * reps;
          });
          return { date: s.performed_on, top: top, vol: vol };
        });
        if (!points.length) { body.innerHTML = '<div class="empty"><div class="big">📈</div>No finished sets for this exercise yet.</div>'; return; }
        var best = points.reduce(function (a, p) { return Math.max(a, p.top); }, 0);
        var lastP = points[points.length - 1];
        var html = '<div class="stat-row">' +
          '<div class="stat"><div class="k">Best</div><div class="v num">' + fmtW(best) + ' ' + unit() + '</div></div>' +
          '<div class="stat"><div class="k">Last</div><div class="v num">' + fmtW(lastP.top) + ' ' + unit() + '</div></div>' +
          '<div class="stat"><div class="k">Sessions</div><div class="v num">' + points.length + '</div></div></div>';
        html += '<div class="chartwrap"><h3>Top set weight (' + unit() + ')</h3>' + lineChart(points.map(function (p) { return { x: p.date, y: p.top }; })) + '</div>';
        html += '<div class="chartwrap"><h3>Volume (weight × reps)</h3>' + lineChart(points.map(function (p) { return { x: p.date, y: p.vol }; })) + '</div>';
        html += '<div class="section-head">History</div>';
        html += points.slice().reverse().map(function (p) {
          return '<div class="card"><div class="row"><div class="grow">' + fmtDate(p.date) + '</div>' +
            '<div class="num">' + fmtW(p.top) + ' ' + unit() + ' top · ' + Math.round(p.vol) + ' vol</div></div></div>';
        }).join('');
        body.innerHTML = html;
      });
  }

  function lineChart(data) {
    var W = 320, H = 150, pad = 8, padB = 22;
    if (data.length === 1) data = [{ x: data[0].x, y: data[0].y }, { x: data[0].x, y: data[0].y }];
    var ys = data.map(function (d) { return d.y; });
    var maxY = Math.max.apply(null, ys), minY = Math.min.apply(null, ys);
    if (maxY === minY) { maxY = maxY + 1; minY = Math.max(0, minY - 1); }
    var n = data.length;
    function px(i) { return pad + (i / (n - 1)) * (W - pad * 2); }
    function py(v) { return pad + (1 - (v - minY) / (maxY - minY)) * (H - pad - padB); }
    var d = '', dots = '';
    data.forEach(function (p, i) {
      d += (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ' ' + py(p.y).toFixed(1) + ' ';
      dots += '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" r="3" fill="#2f855a"/>';
    });
    var area = d + 'L' + px(n - 1).toFixed(1) + ' ' + (H - padB) + ' L' + px(0).toFixed(1) + ' ' + (H - padB) + ' Z';
    var firstLbl = '<text x="' + pad + '" y="' + (H - 6) + '" font-size="11" fill="#9aa3ab">' + fmtDate(data[0].x) + '</text>';
    var lastLbl = '<text x="' + (W - pad) + '" y="' + (H - 6) + '" font-size="11" fill="#9aa3ab" text-anchor="end">' + fmtDate(data[n - 1].x) + '</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="#e6f2ec"/>' +
      '<path d="' + d + '" fill="none" stroke="#2f855a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + firstLbl + lastLbl + '</svg>';
  }

  /* ----------------------------------------------------------------------- *
   * Exercises library
   * ----------------------------------------------------------------------- */
  function renderExercises() {
    var q = ($('ex-search').value || '').toLowerCase().trim();
    var box = $('exercises-list');
    var list = state.exercises.filter(function (e) {
      return !q || e.name.toLowerCase().indexOf(q) !== -1 || (e.muscle_group || '').toLowerCase().indexOf(q) !== -1;
    });
    if (!list.length) { box.innerHTML = '<div class="empty">No exercises match.</div>'; return; }
    var groups = {};
    list.forEach(function (e) { (groups[e.muscle_group || 'Other'] = groups[e.muscle_group || 'Other'] || []).push(e); });
    var html = '';
    Object.keys(groups).sort().forEach(function (g) {
      html += '<div class="section-head">' + esc(g) + '</div>';
      groups[g].forEach(function (e) {
        html += '<div class="card"><div class="row"><div class="grow"><div style="font-weight:650">' + esc(e.name) + '</div>' +
          '<div class="muted" style="font-size:13px">' + esc(e.equipment || '') +
          (e.user_id ? ' · <span class="faint">custom</span>' : '') + '</div></div>' +
          '<button class="iconbtn" data-prog="' + e.id + '">📈</button></div>' +
          (e.description ? '<div class="muted" style="font-size:14px;margin-top:8px">' + esc(e.description) + '</div>' : '') +
          '</div>';
      });
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-prog]').forEach(function (b) {
      b.addEventListener('click', function () { openProgress(+b.getAttribute('data-prog')); });
    });
  }

  /* ----------------------------------------------------------------------- *
   * Modals / sheets
   * ----------------------------------------------------------------------- */
  function openSheet(html) {
    var root = $('modal-root');
    root.innerHTML = '<div class="modal-back"><div class="sheet">' + html + '</div></div>';
    var back = root.querySelector('.modal-back');
    back.addEventListener('click', function (e) { if (e.target === back) closeSheet(); });
    return root.querySelector('.sheet');
  }
  function closeSheet() { $('modal-root').innerHTML = ''; }

  function openSettings() {
    var u = unit();
    var sheet = openSheet('<h2>Settings</h2>' +
      '<label class="field"><span>Weight unit</span>' +
      '<select id="set-unit"><option value="lb"' + (u === 'lb' ? ' selected' : '') + '>Pounds (lb)</option>' +
      '<option value="kg"' + (u === 'kg' ? ' selected' : '') + '>Kilograms (kg)</option></select></label>' +
      '<div class="muted" style="font-size:14px;margin-bottom:18px">Signed in as ' + esc(state.user.email || '') + '</div>' +
      '<div class="stack"><button class="btn" id="set-save">Done</button>' +
      '<button class="btn danger" id="set-signout">Sign out</button></div>');
    sheet.querySelector('#set-unit').addEventListener('change', function (e) { setUnit(e.target.value); });
    sheet.querySelector('#set-save').addEventListener('click', function () { closeSheet(); renderTemplatesTab(); });
    sheet.querySelector('#set-signout').addEventListener('click', function () { closeSheet(); signOut(); });
  }

  var MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Legs','Glutes','Core','Cardio','Other'];
  var EQUIP = ['Dumbbell','Barbell','Cable','Machine','Bodyweight','Kettlebell','Band','Other'];
  function openExerciseForm() {
    var sheet = openSheet('<h2>New exercise</h2>' +
      '<label class="field"><span>Name</span><input id="nx-name" placeholder="e.g. Goblet Squat" /></label>' +
      '<label class="field"><span>Muscle group</span><select id="nx-muscle">' +
        MUSCLES.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Equipment</span><select id="nx-equip">' +
        EQUIP.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Description (optional)</span><textarea id="nx-desc" rows="3"></textarea></label>' +
      '<div id="nx-msg" class="msg"></div>' +
      '<div class="stack"><button class="btn" id="nx-save">Save</button>' +
      '<button class="btn secondary" id="nx-cancel">Cancel</button></div>');
    sheet.querySelector('#nx-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#nx-save').addEventListener('click', function () {
      var name = sheet.querySelector('#nx-name').value.trim();
      if (!name) { var m = sheet.querySelector('#nx-msg'); m.className = 'msg show err'; m.textContent = 'Name is required.'; return; }
      sb.from('exercises').insert({
        user_id: state.user.id, name: name,
        muscle_group: sheet.querySelector('#nx-muscle').value,
        equipment: sheet.querySelector('#nx-equip').value,
        description: sheet.querySelector('#nx-desc').value.trim() || null
      }).then(function (r) {
        if (r.error) { var m = sheet.querySelector('#nx-msg'); m.className = 'msg show err'; m.textContent = r.error.message; return; }
        closeSheet(); loadExercises().then(renderExercises);
      });
    });
  }

  function pickExercise(cb) {
    var html = '<h2>Pick an exercise</h2>' +
      '<input id="pk-search" type="search" placeholder="Search…" style="margin-bottom:14px" />' +
      '<div id="pk-list"></div>';
    var sheet = openSheet(html);
    function paint() {
      var q = (sheet.querySelector('#pk-search').value || '').toLowerCase().trim();
      var list = state.exercises.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) !== -1; });
      sheet.querySelector('#pk-list').innerHTML = list.map(function (e) {
        return '<button class="card tap" data-pick="' + e.id + '"><div style="font-weight:650">' + esc(e.name) + '</div>' +
          '<div class="muted" style="font-size:13px">' + esc(e.muscle_group || '') + ' · ' + esc(e.equipment || '') + '</div></button>';
      }).join('') || '<div class="empty">No matches.</div>';
      sheet.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () {
          var ex = state.exById[+b.getAttribute('data-pick')];
          closeSheet(); cb(ex);
        });
      });
    }
    sheet.querySelector('#pk-search').addEventListener('input', paint);
    paint();
  }

  /* ----------------------------------------------------------------------- *
   * Template editor
   * ----------------------------------------------------------------------- */
  var PHASES = ['', 'Month 1', 'Month 2'];
  function openTemplateEditor(templateId) {
    var loader = templateId ? getTemplate(templateId) : Promise.resolve({ name: '', phase: '', template_exercises: [] });
    loader.then(function (t) {
      var items = (t.template_exercises || []).map(function (te) {
        return { exercise_id: te.exercise_id, name: (state.exById[te.exercise_id] || {}).name || 'Exercise',
          section: te.section || '', target_sets: te.target_sets || '3',
          target_reps: te.target_reps || '10-15', target_rest: te.target_rest || '2-3 min' };
      });
      var draft = { id: templateId, name: t.name || '', phase: t.phase || '', items: items };
      paintEditor(draft);
    });
  }
  function paintEditor(draft) {
    var html = '<h2>' + (draft.id ? 'Edit template' : 'New template') + '</h2>' +
      '<label class="field"><span>Name</span><input id="te-name" value="' + esc(draft.name) + '" placeholder="e.g. Full Body Split" /></label>' +
      '<label class="field"><span>Phase</span><select id="te-phase">' +
        PHASES.map(function (p) { return '<option value="' + p + '"' + (draft.phase === p ? ' selected' : '') + '>' + (p || 'None') + '</option>'; }).join('') +
      '</select></label>' +
      '<div class="section-head" style="margin-top:6px">Exercises</div><div id="te-items"></div>' +
      '<button class="btn ghost" id="te-add" style="width:100%;margin:6px 0 16px">+ Add exercise</button>' +
      '<div id="te-msg" class="msg"></div>' +
      '<div class="stack"><button class="btn" id="te-save">Save template</button>' +
      (draft.id ? '<button class="btn danger" id="te-delete">Delete template</button>' : '') +
      '<button class="btn secondary" id="te-cancel">Cancel</button></div>';
    var sheet = openSheet(html);

    function paintItems() {
      var box = sheet.querySelector('#te-items');
      if (!draft.items.length) { box.innerHTML = '<div class="muted" style="font-size:14px;padding:4px 2px 10px">No exercises yet.</div>'; return; }
      box.innerHTML = draft.items.map(function (it, i) {
        return '<div class="card" style="padding:12px"><div class="row" style="margin-bottom:8px">' +
          '<div class="grow" style="font-weight:650">' + esc(it.name) + '</div>' +
          '<button class="iconbtn" data-up="' + i + '" title="Up">↑</button>' +
          '<button class="iconbtn" data-down="' + i + '" title="Down">↓</button>' +
          '<button class="iconbtn" data-rm="' + i + '" title="Remove">✕</button></div>' +
          '<div class="row" style="gap:8px">' +
          '<input data-fi="section" data-i="' + i + '" placeholder="Section" value="' + esc(it.section) + '" style="flex:1.4" />' +
          '<input data-fi="target_sets" data-i="' + i + '" placeholder="Sets" value="' + esc(it.target_sets) + '" />' +
          '</div><div class="row" style="gap:8px;margin-top:8px">' +
          '<input data-fi="target_reps" data-i="' + i + '" placeholder="Reps" value="' + esc(it.target_reps) + '" />' +
          '<input data-fi="target_rest" data-i="' + i + '" placeholder="Rest" value="' + esc(it.target_rest) + '" />' +
          '</div></div>';
      }).join('');
      box.querySelectorAll('[data-fi]').forEach(function (inp) {
        inp.addEventListener('change', function () { draft.items[+inp.getAttribute('data-i')][inp.getAttribute('data-fi')] = inp.value; });
      });
      box.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () { draft.items.splice(+b.getAttribute('data-rm'), 1); paintItems(); });
      });
      box.querySelectorAll('[data-up]').forEach(function (b) {
        b.addEventListener('click', function () { var i = +b.getAttribute('data-up'); if (i > 0) { var t = draft.items[i - 1]; draft.items[i - 1] = draft.items[i]; draft.items[i] = t; paintItems(); } });
      });
      box.querySelectorAll('[data-down]').forEach(function (b) {
        b.addEventListener('click', function () { var i = +b.getAttribute('data-down'); if (i < draft.items.length - 1) { var t = draft.items[i + 1]; draft.items[i + 1] = draft.items[i]; draft.items[i] = t; paintItems(); } });
      });
    }
    paintItems();

    sheet.querySelector('#te-name').addEventListener('change', function (e) { draft.name = e.target.value; });
    sheet.querySelector('#te-phase').addEventListener('change', function (e) { draft.phase = e.target.value; });
    sheet.querySelector('#te-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#te-add').addEventListener('click', function () {
      // re-sync field values before re-render
      pickExercise(function (ex) {
        draft.items.push({ exercise_id: ex.id, name: ex.name, section: '',
          target_sets: '3', target_reps: '10-15', target_rest: '2-3 min' });
        paintEditor(draft);
      });
    });
    if (draft.id) sheet.querySelector('#te-delete').addEventListener('click', function () {
      if (!confirm('Delete this template? Logged workouts are kept.')) return;
      sb.from('templates').delete().eq('id', draft.id).then(function () { closeSheet(); renderTemplatesTab(); });
    });
    sheet.querySelector('#te-save').addEventListener('click', function () {
      draft.name = sheet.querySelector('#te-name').value.trim();
      if (!draft.name) { var m = sheet.querySelector('#te-msg'); m.className = 'msg show err'; m.textContent = 'Name is required.'; return; }
      saveTemplate(draft).then(function () { closeSheet(); renderTemplatesTab(); });
    });
  }

  function saveTemplate(draft) {
    var phase = draft.phase || null;
    var upsertTpl = draft.id
      ? sb.from('templates').update({ name: draft.name, phase: phase }).eq('id', draft.id).then(function () { return draft.id; })
      : sb.from('templates').insert({ user_id: state.user.id, name: draft.name, phase: phase })
          .select('id').single().then(function (r) { return r.data.id; });
    return upsertTpl.then(function (tid) {
      return sb.from('template_exercises').delete().eq('template_id', tid).then(function () {
        if (!draft.items.length) return;
        var rows = draft.items.map(function (it, i) {
          return { template_id: tid, exercise_id: it.exercise_id, user_id: state.user.id,
            section: it.section || null, position: i + 1,
            target_sets: it.target_sets || null, target_reps: it.target_reps || null, target_rest: it.target_rest || null };
        });
        return sb.from('template_exercises').insert(rows);
      });
    });
  }

  /* ----------------------------------------------------------------------- *
   * Go
   * ----------------------------------------------------------------------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
