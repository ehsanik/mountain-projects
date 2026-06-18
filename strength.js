/* ===========================================================================
 * Strength Log — client logic (Supabase auth + Postgres with RLS)
 * =========================================================================== */
(function () {
  "use strict";

  // A starter set of common strength exercises. You can also type your own —
  // anything you log becomes a future option automatically.
  var DEFAULT_EXERCISES = [
    "Back Squat", "Front Squat", "Deadlift", "Romanian Deadlift",
    "Bench Press", "Incline Bench Press", "Overhead Press",
    "Barbell Row", "Pull-up", "Lat Pulldown", "Seated Cable Row",
    "Dumbbell Curl", "Tricep Pushdown", "Leg Press", "Leg Curl",
    "Leg Extension", "Hip Thrust", "Lunge", "Calf Raise",
    "Lateral Raise", "Face Pull", "Plank", "Hanging Leg Raise"
  ];

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.STRENGTH_CONFIG || {};
  var sb = null;
  var currentRating = 0;
  var knownExercises = DEFAULT_EXERCISES.slice();

  // ---- view switching ------------------------------------------------------
  function show(viewId) {
    ["view-setup", "view-auth", "view-app"].forEach(function (v) {
      $(v).classList.toggle("hidden", v !== viewId);
    });
  }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function isConfigured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      cfg.SUPABASE_URL.indexOf("YOUR_SUPABASE") === -1 &&
      cfg.SUPABASE_ANON_KEY.indexOf("YOUR_SUPABASE") === -1;
  }

  // ---- date helpers --------------------------------------------------------
  function localDatetimeValue(d) {
    // Format a Date as a value for <input type=datetime-local> in local time.
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined,
      { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---- exercise datalist / picker -----------------------------------------
  function refreshExerciseOptions() {
    knownExercises.sort(function (a, b) { return a.localeCompare(b); });
    var dl = $("exercise-options");
    dl.innerHTML = "";
    knownExercises.forEach(function (name) {
      var o = document.createElement("option");
      o.value = name;
      dl.appendChild(o);
    });
  }

  function rememberExercise(name) {
    name = (name || "").trim();
    if (name && knownExercises.indexOf(name) === -1) {
      knownExercises.push(name);
      refreshExerciseOptions();
    }
  }

  // ---- "Log Session" set rows ---------------------------------------------
  function addSetRow(prefill) {
    prefill = prefill || {};
    var container = $("sets-container");
    var block = document.createElement("div");
    block.className = "set-block";
    block.innerHTML =
      '<button class="remove" title="Remove">&times;</button>' +
      '<div class="row" style="margin-bottom:8px">' +
        '<input type="text" class="ex-name-input" list="exercise-options" placeholder="Exercise (e.g. Back Squat)">' +
      '</div>' +
      '<div class="grid-3">' +
        '<input type="number" class="ex-weight" step="0.5" inputmode="decimal" placeholder="Weight">' +
        '<input type="number" class="ex-reps" step="1" inputmode="numeric" placeholder="Reps">' +
        '<input type="number" class="ex-setnum" step="1" inputmode="numeric" placeholder="Set #">' +
      '</div>';
    block.querySelector(".ex-name-input").value = prefill.exercise || "";
    block.querySelector(".remove").addEventListener("click", function () {
      if ($("sets-container").children.length > 1) block.remove();
      else toast("Keep at least one set");
    });
    block.querySelector(".ex-name-input").addEventListener("change", function () {
      rememberExercise(this.value);
    });
    container.appendChild(block);
  }

  function collectSets() {
    var blocks = $("sets-container").querySelectorAll(".set-block");
    var out = [];
    blocks.forEach(function (b) {
      var name = b.querySelector(".ex-name-input").value.trim();
      if (!name) return;
      var w = b.querySelector(".ex-weight").value;
      var r = b.querySelector(".ex-reps").value;
      var s = b.querySelector(".ex-setnum").value;
      out.push({
        exercise: name,
        weight: w === "" ? null : Number(w),
        reps: r === "" ? null : parseInt(r, 10),
        set_number: s === "" ? null : parseInt(s, 10)
      });
    });
    return out;
  }

  function resetLogForm() {
    $("sets-container").innerHTML = "";
    addSetRow();
    $("notes").value = "";
    setRating(0);
    $("performed_at").value = localDatetimeValue(new Date());
    $("save-err").textContent = "";
  }

  // ---- rating stars --------------------------------------------------------
  function setRating(v) {
    currentRating = v;
    var stars = $("rating-stars").querySelectorAll(".star");
    stars.forEach(function (s) {
      s.classList.toggle("on", Number(s.dataset.v) <= v);
    });
  }

  // ---- save ----------------------------------------------------------------
  function saveSession() {
    var sets = collectSets();
    $("save-err").textContent = "";
    if (sets.length === 0) {
      $("save-err").textContent = "Add at least one exercise with a name.";
      return;
    }
    var btn = $("btn-save");
    btn.disabled = true; btn.textContent = "Saving…";

    var performedAt = $("performed_at").value
      ? new Date($("performed_at").value).toISOString()
      : new Date().toISOString();

    sb.from("sessions").insert({
      performed_at: performedAt,
      rating: currentRating || null,
      notes: $("notes").value.trim() || null
    }).select().single().then(function (res) {
      if (res.error) throw res.error;
      var sessionId = res.data.id;
      var rows = sets.map(function (s) {
        return {
          session_id: sessionId,
          exercise: s.exercise,
          weight: s.weight,
          reps: s.reps,
          set_number: s.set_number
        };
      });
      return sb.from("exercise_sets").insert(rows);
    }).then(function (res) {
      if (res && res.error) throw res.error;
      sets.forEach(function (s) { rememberExercise(s.exercise); });
      toast("Session saved 💪");
      resetLogForm();
    }).catch(function (err) {
      $("save-err").textContent = err.message || "Could not save. Try again.";
    }).finally(function () {
      btn.disabled = false; btn.textContent = "Save Session";
    });
  }

  // ---- history -------------------------------------------------------------
  function loadHistory() {
    var el = $("history-list");
    el.innerHTML = '<div class="empty">Loading…</div>';
    sb.from("sessions")
      .select("id, performed_at, rating, notes, exercise_sets ( exercise, weight, reps, set_number )")
      .order("performed_at", { ascending: false })
      .limit(200)
      .then(function (res) {
        if (res.error) { el.innerHTML = '<div class="empty">' + res.error.message + "</div>"; return; }
        var sessions = res.data || [];
        if (!sessions.length) {
          el.innerHTML = '<div class="empty">No sessions yet. Log your first one!</div>';
          return;
        }
        // collect exercises seen for the picker datalist
        sessions.forEach(function (s) {
          (s.exercise_sets || []).forEach(function (x) { rememberExercise(x.exercise); });
        });
        el.innerHTML = "";
        sessions.forEach(function (s) {
          el.appendChild(renderSessionCard(s));
        });
      });
  }

  function renderSessionCard(s) {
    var card = document.createElement("div");
    card.className = "session-card";
    var stars = s.rating ? "★★★★★".slice(0, s.rating) + "☆☆☆☆☆".slice(0, 5 - s.rating) : "";
    var head = '<div class="sc-head">' +
      '<span class="sc-date">' + fmtDate(s.performed_at) +
      ' <span class="sc-time">· ' + fmtTime(s.performed_at) + "</span></span>" +
      '<span class="sc-rating">' + stars + "</span></div>";
    var notes = s.notes ? '<div class="sc-notes">“' + escapeHtml(s.notes) + "”</div>" : "";
    var lines = (s.exercise_sets || []).map(function (x) {
      var detail = [];
      if (x.weight != null) detail.push(x.weight);
      if (x.reps != null) detail.push("× " + x.reps);
      var setLbl = x.set_number != null ? '<span class="muted">set ' + x.set_number + "</span> " : "";
      return '<div class="ex-line"><span class="ex-name">' + escapeHtml(x.exercise) +
        '</span><span class="ex-detail">' + setLbl + detail.join(" ") + "</span></div>";
    }).join("");
    var del = '<div style="text-align:right;margin-top:8px">' +
      '<button class="add-link" style="color:#b91c1c" data-del="' + s.id + '">Delete</button></div>';
    card.innerHTML = head + notes + lines + del;
    card.querySelector("[data-del]").addEventListener("click", function () {
      if (!confirm("Delete this whole session?")) return;
      sb.from("sessions").delete().eq("id", s.id).then(function (res) {
        if (res.error) { toast(res.error.message); return; }
        card.remove();
        toast("Deleted");
      });
    });
    return card;
  }

  // ---- by exercise ---------------------------------------------------------
  function populateExercisePicker() {
    var sel = $("ex-picker");
    var prev = sel.value;
    sel.innerHTML = "";
    knownExercises.forEach(function (name) {
      var o = document.createElement("option");
      o.value = name; o.textContent = name;
      sel.appendChild(o);
    });
    if (prev && knownExercises.indexOf(prev) !== -1) sel.value = prev;
  }

  function loadExerciseHistory(name) {
    var statsEl = $("ex-stats");
    var histEl = $("ex-history");
    histEl.innerHTML = '<div class="empty">Loading…</div>';
    statsEl.innerHTML = "";
    sb.from("exercise_sets")
      .select("weight, reps, set_number, sessions!inner ( performed_at )")
      .eq("exercise", name)
      .then(function (res) {
        if (res.error) { histEl.innerHTML = '<div class="empty">' + res.error.message + "</div>"; return; }
        var rows = (res.data || []).map(function (r) {
          return {
            performed_at: r.sessions.performed_at,
            weight: r.weight, reps: r.reps, set_number: r.set_number
          };
        });
        rows.sort(function (a, b) { return new Date(b.performed_at) - new Date(a.performed_at); });
        if (!rows.length) {
          histEl.innerHTML = '<div class="empty">No history for ' + escapeHtml(name) + " yet.</div>";
          return;
        }
        var maxW = rows.reduce(function (m, r) { return r.weight != null && r.weight > m ? r.weight : m; }, -Infinity);
        if (maxW === -Infinity) maxW = null;
        var totalSets = rows.length;
        var lastDate = rows[0].performed_at;
        statsEl.innerHTML =
          '<div class="stat-strip">' +
            '<div class="stat"><div class="v">' + (maxW != null ? maxW : "–") + '</div><div class="k">Best weight</div></div>' +
            '<div class="stat"><div class="v">' + totalSets + '</div><div class="k">Sets logged</div></div>' +
            '<div class="stat"><div class="v">' + fmtDate(lastDate).replace(/,.*/, "") + '</div><div class="k">Last done</div></div>' +
          "</div>";
        var body = rows.map(function (r) {
          var isPr = maxW != null && r.weight === maxW;
          return "<tr><td>" + fmtDate(r.performed_at) + "</td>" +
            '<td class="num">' + (r.weight != null ? r.weight : "–") +
            (isPr ? '<span class="pr-badge">PR</span>' : "") + "</td>" +
            '<td class="num">' + (r.reps != null ? r.reps : "–") + "</td></tr>";
        }).join("");
        histEl.innerHTML =
          '<table class="hist-table"><thead><tr><th>Date</th><th>Weight</th><th>Reps</th></tr></thead>' +
          "<tbody>" + body + "</tbody></table>";
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- tabs ----------------------------------------------------------------
  function activateTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    ["log", "history", "exercise"].forEach(function (n) {
      $("tab-" + n).classList.toggle("hidden", n !== name);
    });
    if (name === "history") loadHistory();
    if (name === "exercise") {
      populateExercisePicker();
      if ($("ex-picker").value) loadExerciseHistory($("ex-picker").value);
    }
  }

  // ---- auth ----------------------------------------------------------------
  var signupMode = false;

  function doAuth() {
    var email = $("email").value.trim();
    var password = $("password").value;
    $("auth-err").textContent = "";
    if (!email || !password) { $("auth-err").textContent = "Enter email and password."; return; }
    var btn = $("btn-login");
    btn.disabled = true; btn.textContent = "…";
    var p = signupMode
      ? sb.auth.signUp({ email: email, password: password })
      : sb.auth.signInWithPassword({ email: email, password: password });
    p.then(function (res) {
      if (res.error) { $("auth-err").textContent = res.error.message; return; }
      if (signupMode && !res.data.session) {
        $("auth-err").textContent = "Account created. Check your email to confirm, then sign in.";
        setSignupMode(false);
      }
      // onAuthStateChange handles the success path.
    }).finally(function () {
      btn.disabled = false; btn.textContent = signupMode ? "Sign Up" : "Sign In";
    });
  }

  function setSignupMode(on) {
    signupMode = on;
    $("btn-login").textContent = on ? "Sign Up" : "Sign In";
    $("toggle-signup").textContent = on ? "Have an account? Sign in" : "Need an account? Sign up";
    $("password").setAttribute("autocomplete", on ? "new-password" : "current-password");
  }

  function enterApp(session) {
    $("who").textContent = session.user.email;
    show("view-app");
    resetLogForm();
    refreshExerciseOptions();
    activateTab("log");
  }

  // ---- init ----------------------------------------------------------------
  function init() {
    if (!isConfigured()) { show("view-setup"); return; }
    if (!window.supabase) { show("view-setup"); return; }

    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    // wire events
    $("btn-login").addEventListener("click", doAuth);
    $("password").addEventListener("keydown", function (e) { if (e.key === "Enter") doAuth(); });
    $("toggle-signup").addEventListener("click", function () { setSignupMode(!signupMode); });
    $("btn-logout").addEventListener("click", function () { sb.auth.signOut(); });
    $("add-set").addEventListener("click", function () { addSetRow(); });
    $("btn-save").addEventListener("click", saveSession);
    $("rating-stars").querySelectorAll(".star").forEach(function (s) {
      s.addEventListener("click", function () {
        var v = Number(s.dataset.v);
        setRating(v === currentRating ? 0 : v); // click same star again to clear
      });
    });
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { activateTab(t.dataset.tab); });
    });
    $("ex-picker").addEventListener("change", function () { loadExerciseHistory(this.value); });

    refreshExerciseOptions();

    sb.auth.onAuthStateChange(function (_event, session) {
      if (session) enterApp(session);
      else { show("view-auth"); setSignupMode(false); }
    });

    sb.auth.getSession().then(function (res) {
      if (res.data.session) enterApp(res.data.session);
      else show("view-auth");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
