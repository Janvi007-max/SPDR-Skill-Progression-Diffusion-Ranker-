const DATA = SPDR_DATA;
const AXES = DATA.meta.axes;
const AXIS_LABELS = DATA.meta.axis_labels;
const TARGET_VECTOR = { retrieval_ir:0.95, vector_infra:0.90, ranking_eval:0.85, python_engineering:0.85, llm_finetuning:0.55, production_mlops:0.55, applied_ml_core:0.60, adjacent_ml_noise:0.15, non_ml_noise:0.05 };

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".navtab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNav() {
  document.querySelectorAll(".navtab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));
}

function animateCount(el, target) {
  let cur = 0; const steps = 40, inc = target / steps;
  const t = setInterval(() => { cur += inc; if (cur >= target) { el.textContent = target.toLocaleString(); clearInterval(t); } else { el.textContent = Math.floor(cur).toLocaleString(); } }, 18);
}
function initHeroStats() {
  document.querySelectorAll(".hstat-num").forEach(el => {
    const c = el.dataset.count;
    if (c !== undefined && c !== "0") animateCount(el, parseInt(c, 10));
  });
}

function renderPipelineRail() {
  const stages = [
    { num: "STAGE 1", title: "Ingest & Parse", desc: "Stream 100K JSONL candidates into a flat 9-axis feature matrix.", stat: "100,000" },
    { num: "STAGE 2", title: "Eligibility Gate", desc: "Hard JD disqualifiers: consulting-only careers, pure research with no shipping, honeypot checks.", stat: "92,324 pass" },
    { num: "STAGE 3", title: "Title↔Career Corroboration", desc: "Skill claims discounted unless corroborated by career-history text — defeats keyword stuffing.", stat: "0 stuffers ranked" },
    { num: "STAGE 4", title: "SPDR Diffusion Simulation", desc: "Role-conditioned stochastic simulation projects skill state forward 3/6/12 months.", stat: "64 MC paths × 9 axes" },
    { num: "STAGE 5", title: "Composite & Explain", desc: "Eligibility × Availability × Location × (0.4·Current + 0.6·Future).", stat: "Top 100 ranked" },
  ];
  document.getElementById("pipeline-rail").innerHTML = stages.map(s => `
    <div class="pipe-card"><div class="pipe-num">${s.num}</div><h3>${s.title}</h3><p>${s.desc}</p><div class="pipe-stat">${s.stat}</div></div>`).join("");
}

function renderAxisGrid() {
  const mustHave = new Set(["retrieval_ir","vector_infra","ranking_eval","python_engineering"]);
  const niceHave = new Set(["llm_finetuning","production_mlops"]);
  document.getElementById("axis-grid").innerHTML = AXES.map(a => {
    const tag = mustHave.has(a) ? '<span class="axis-tag must">MUST-HAVE</span>' : niceHave.has(a) ? '<span class="axis-tag nice">NICE-TO-HAVE</span>' : '<span class="axis-tag noise">LOW SIGNAL</span>';
    const target = TARGET_VECTOR[a] || 0;
    return `<div class="axis-card"><div class="axis-card-top"><div class="axis-name">${AXIS_LABELS[a]||a}</div>${tag}</div>
      <div class="axis-bar-track"><div class="axis-bar-fill" style="width:${target*100}%"></div></div>
      <div class="axis-desc">Role target: ${target.toFixed(2)}</div></div>`;
  }).join("");
}

function renderOverviewCharts() {
  renderScatterChart("scatter-chart", DATA.population_sample, DATA.top_100);
  renderFunnelChart("funnel-chart", DATA.meta);
  renderHeroOrb("hero-diffusion-svg");
}

function scorePillClass(score) { return score >= 0.65 ? "" : score >= 0.45 ? "mid" : "low"; }

function renderLeaderboard(filterText = "", sortKey = "rank") {
  let rows = DATA.top_100.slice();
  if (filterText) {
    const f = filterText.toLowerCase();
    rows = rows.filter(d => (d.name||"").toLowerCase().includes(f) || (d.title||"").toLowerCase().includes(f) || (d.company||"").toLowerCase().includes(f) || (d.location||"").toLowerCase().includes(f));
  }
  if (sortKey === "current_fit") rows.sort((a,b) => b.current_fit - a.current_fit);
  else if (sortKey === "future_fit") rows.sort((a,b) => b.future_fit - a.future_fit);
  else if (sortKey === "growth") rows.sort((a,b) => (b.future_fit-b.current_fit) - (a.future_fit-a.current_fit));
  else rows.sort((a,b) => a.rank - b.rank);

  document.getElementById("lb-rows").innerHTML = rows.map(d => `
    <div class="lb-row" onclick="openCandidateModal('${d.candidate_id}')">
      <div class="lb-col lb-col-rank">${d.rank}</div>
      <div class="lb-col lb-col-name"><div class="lb-name-block"><div class="lb-name">${d.name}</div><div class="lb-title">${d.title} · ${d.company}</div></div></div>
      <div class="lb-col lb-col-loc">${d.location}</div>
      <div class="lb-col lb-col-bar"><div class="lb-fitbar-wrap"><div class="lb-fitbar-track"><div class="lb-fitbar-current" style="width:${d.current_fit*100}%"></div></div>
        <div class="lb-fit-nums">${d.current_fit.toFixed(2)}→${d.future_fit.toFixed(2)}</div></div></div>
      <div class="lb-col lb-col-score"><span class="score-pill ${scorePillClass(d.composite)}">${d.composite.toFixed(3)}</span></div>
    </div>`).join("");
}

function initLeaderboardControls() {
  document.getElementById("lb-search").addEventListener("input", e => renderLeaderboard(e.target.value, document.getElementById("lb-sort").value));
  document.getElementById("lb-sort").addEventListener("change", e => renderLeaderboard(document.getElementById("lb-search").value, e.target.value));
}

function findCandidate(id) { return DATA.top_100.find(d => d.candidate_id === id); }

function buildCandidateHTML(d) {
  const initials = (d.name||"??").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const delta = d.future_fit - d.current_fit;
  const flagsHtml = (d.plausibility_flags||[]).length ? d.plausibility_flags.map(f => `<span class="flag-chip">⚠ ${f}</span>`).join("") : `<span class="flag-chip ok">✓ No plausibility concerns</span>`;
  const availHtml = (d.avail_notes||[]).length ? d.avail_notes.map(n => `<span class="flag-chip">${n}</span>`).join("") : `<span class="flag-chip ok">✓ Active, responsive</span>`;
  return `
    <div class="cand-header">
      <div class="cand-id-block"><div class="cand-avatar">${initials}</div>
        <div><div class="cand-name">${d.name}</div><div class="cand-meta">${d.title} at ${d.company} · ${d.years_experience.toFixed(1)} yrs · ${d.location}</div></div></div>
      <div class="cand-rank-badge">Rank #${d.rank} · Score ${d.composite.toFixed(3)}</div>
    </div>
    <div class="cand-grid">
      <div class="glass-panel cand-panel"><div class="cand-panel-title">Fit Trajectory</div>
        <div class="fit-score-row">
          <div class="fit-score-box"><div class="fit-score-label">Current Fit</div><div class="fit-score-val current">${d.current_fit.toFixed(2)}</div></div>
          <div class="fit-score-arrow">→</div>
          <div class="fit-score-box"><div class="fit-score-label">Future Fit (6mo)</div><div class="fit-score-val future">${d.future_fit.toFixed(2)}</div></div>
        </div>
        <div id="diffusion-host-${d.candidate_id}" class="diffusion-host"></div>
      </div>
      <div class="glass-panel cand-panel"><div class="cand-panel-title">Scoring Breakdown</div>
        <div class="factor-list">
          <div class="factor-row"><span class="factor-name">Eligibility gate</span><span class="factor-val ${d.eligible?'pos':'neg'}">${d.eligible?'PASS':'FAIL'}</span></div>
          <div class="factor-row"><span class="factor-name">Current fit</span><span class="factor-val neu">${d.current_fit.toFixed(3)}</span></div>
          <div class="factor-row"><span class="factor-name">Future fit (SPDR, 6mo)</span><span class="factor-val neu">${d.future_fit.toFixed(3)}</span></div>
          <div class="factor-row"><span class="factor-name">Growth potential (Δ)</span><span class="factor-val ${delta>=0?'pos':'neg'}">${delta>=0?'+':''}${delta.toFixed(3)}</span></div>
          <div class="factor-row"><span class="factor-name">Availability multiplier</span><span class="factor-val neu">×${d.avail_mult.toFixed(2)}</span></div>
          <div class="factor-row"><span class="factor-name">Location multiplier</span><span class="factor-val neu">×${d.loc_mult.toFixed(2)}</span></div>
          <div class="factor-row" style="border-bottom:none;"><span class="factor-name"><strong style="color:#F4F5F8;">Composite score</strong></span><span class="factor-val pos" style="font-size:15px;">${d.composite.toFixed(3)}</span></div>
        </div>
        <div style="margin-top:14px;">${flagsHtml}${availHtml}</div>
      </div>
    </div>
    <div class="glass-panel cand-panel" style="margin-top:20px;"><div class="cand-panel-title">Skill Diffusion — 9-Axis State (current → projected 6mo)</div>
      <div id="skillbars-host-${d.candidate_id}"></div></div>
    <div class="glass-panel cand-panel" style="margin-top:20px;"><div class="cand-panel-title">Ranking Explanation</div>
      <div class="reasoning-box">${d.reasoning}</div></div>`;
}

function mountCandidateVisuals(d) {
  const diffHost = document.getElementById(`diffusion-host-${d.candidate_id}`);
  if (diffHost) renderDiffusionAnimation(diffHost, d.current_state, d.future_state, d.future_std, TARGET_VECTOR, AXES, AXIS_LABELS);
  const skillHost = document.getElementById(`skillbars-host-${d.candidate_id}`);
  if (skillHost) renderSkillBars(skillHost, d.current_state, d.future_state, TARGET_VECTOR, AXIS_LABELS, AXES);
}

function openCandidateModal(id) {
  const d = findCandidate(id); if (!d) return;
  document.getElementById("modal-body").innerHTML = buildCandidateHTML(d);
  document.getElementById("candidate-modal-backdrop").classList.add("open");
  setTimeout(() => mountCandidateVisuals(d), 30);
}
function closeCandidateModal() { document.getElementById("candidate-modal-backdrop").classList.remove("open"); }

function renderTrapsGrid() {
  const m = DATA.meta;
  const cards = [
    { icon:"⚠", cls:"danger", title:"Keyword-Stuffer Trap", body:"Non-AI senior titles (HR Manager, Content Writer, Accountant…) listing 6+ AI buzzwords. A pure embedding/keyword ranker would score these near the top.", stat1:0, stat1l:"in final top 100", stat2:"439", stat2l:"identified in pool", example:"'HR Manager' + RAG, FAISS, Pinecone, LangChain, PyTorch, MLOps listed as skills." },
    { icon:"⚠", cls:"danger", title:"Hobbyist AI-Explorer Trap", body:"~5,517 candidates (5.5% of pool) are non-AI professionals self-describing AI as a side hobby, with plausible-looking but uncorroborated skill durations.", stat1:0, stat1l:"with fit > 0.5", stat2:"5,517", stat2l:"identified in pool", example:"'Mechanical Engineer... taking online courses on RAG and vector databases.'" },
    { icon:"⚠", cls:"warn", title:"Consulting-Only Career", body:"Entire career at TCS / Infosys / Wipro / Accenture / Cognizant / Capgemini with zero product-company exposure — explicit JD disqualifier.", stat1:0, stat1l:"in final top 100", stat2:"7,034", stat2l:"identified in pool", example:"Career history: TCS → TCS → Infosys, 9.2 years, never left consulting." },
    { icon:"⚠", cls:"warn", title:"Honeypot / Implausible Profiles", body:"Internally inconsistent profiles: single-role tenure exceeding total stated experience, or 'expert' skills claimed with ~0 months of use.", stat1:m.honeypot_flagged, stat1l:"flagged in top 100 (≤10% allowed)", stat2:"45+", stat2l:"identified in pool", example:"3+ skills at 'expert' proficiency with 0-1 months of recorded use." },
  ];
  document.getElementById("traps-grid").innerHTML = cards.map(c => `
    <div class="glass-panel trap-card"><div class="trap-card-head"><div class="trap-icon ${c.cls}">${c.icon}</div><h3>${c.title}</h3></div>
      <div class="trap-card-body">${c.body}</div>
      <div class="trap-stat-row"><div class="trap-stat"><div class="trap-stat-num good">${c.stat1}</div><div class="trap-stat-label">${c.stat1l}</div></div>
      <div class="trap-stat"><div class="trap-stat-num bad">${c.stat2}</div><div class="trap-stat-label">${c.stat2l}</div></div></div>
      <div class="trap-example">${c.example}</div></div>`).join("");
}

function copilotAnswer(q) {
  const ql = q.toLowerCase();
  const top = DATA.top_100;
  function listTop(n, by) { return top.slice().sort((a,b)=>b[by]-a[by]).slice(0,n); }
  if (ql.includes("pune") || ql.includes("noida")) {
    const matches = top.filter(d => /pune|noida/i.test(d.location)).sort((a,b)=>a.rank-b.rank).slice(0,5);
    if (!matches.length) return "No candidates in the top 100 are based in Pune or Noida specifically.";
    return "Top candidates based in Pune/Noida:<br>" + matches.map(d => `<span class="cmsg-cand-link" onclick="openCandidateModal('${d.candidate_id}')">#${d.rank} ${d.name}</span> — ${d.title}, fit ${d.current_fit.toFixed(2)}`).join("<br>");
  }
  if (ql.includes("growth") || ql.includes("potential")) {
    const matches = listTop(8, "future_fit").map(d => ({...d, delta: d.future_fit-d.current_fit})).sort((a,b)=>b.delta-a.delta).slice(0,5);
    return "Highest projected growth potential (future fit − current fit):<br>" + matches.map(d => `<span class="cmsg-cand-link" onclick="openCandidateModal('${d.candidate_id}')">#${d.rank} ${d.name}</span> — +${d.delta.toFixed(2)} projected over 6mo`).join("<br>");
  }
  if (ql.includes("top") || ql.includes("best") || ql.includes("strongest")) {
    return "Top 5 candidates by composite score:<br>" + listTop(5, "composite").map(d => `<span class="cmsg-cand-link" onclick="openCandidateModal('${d.candidate_id}')">#${d.rank} ${d.name}</span> — ${d.title}, score ${d.composite.toFixed(3)}`).join("<br>");
  }
  if (ql.includes("flag") || ql.includes("concern") || ql.includes("risk")) {
    const matches = top.filter(d => (d.plausibility_flags||[]).length || (d.avail_notes||[]).length).slice(0,6);
    if (!matches.length) return "No candidates in the top 100 carry any plausibility or availability flags.";
    return "Candidates with at least one flag worth reviewing:<br>" + matches.map(d => `<span class="cmsg-cand-link" onclick="openCandidateModal('${d.candidate_id}')">#${d.rank} ${d.name}</span> — ${(d.plausibility_flags||[]).concat(d.avail_notes||[]).join("; ")}`).join("<br>");
  }
  return "I can answer questions about location, growth potential, top-ranked candidates, or flagged concerns. Try a suggestion below.";
}

function addCopilotMessage(text, who) {
  const box = document.getElementById("copilot-messages");
  const div = document.createElement("div"); div.className = `cmsg ${who}`; div.innerHTML = text;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function initCopilot() {
  const suggestions = ["Who has the highest growth potential?", "Show top candidates in Pune or Noida", "Any flagged concerns in the top 100?", "Who are the top 5 candidates?"];
  document.getElementById("copilot-suggestions").innerHTML = suggestions.map(s => `<span class="suggestion-chip" onclick="sendCopilotMessage('${s.replace(/'/g,"\\'")}')">${s}</span>`).join("");
  addCopilotMessage("Hi — I'm the recruiter copilot. Ask me anything about the ranked shortlist; every answer is computed live from the actual ranking data.", "bot");
  document.getElementById("copilot-send").addEventListener("click", () => {
    const inp = document.getElementById("copilot-input");
    if (inp.value.trim()) { sendCopilotMessage(inp.value.trim()); inp.value = ""; }
  });
  document.getElementById("copilot-input").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("copilot-send").click(); });
  const filters = [
    { label: "Top 10 only", action: () => switchView("leaderboard") },
    { label: "Highest growth potential", action: () => sendCopilotMessage("highest growth potential") },
    { label: "Flagged for review", action: () => sendCopilotMessage("any flagged concerns") },
    { label: "Pune / Noida based", action: () => sendCopilotMessage("pune noida") },
  ];
  const qf = document.getElementById("copilot-quickfilters");
  qf.innerHTML = filters.map((f,i) => `<button class="qf-btn" data-i="${i}">${f.label}</button>`).join("");
  qf.querySelectorAll(".qf-btn").forEach((btn,i) => btn.addEventListener("click", filters[i].action));
}
function sendCopilotMessage(text) {
  addCopilotMessage(text, "user");
  setTimeout(() => addCopilotMessage(copilotAnswer(text), "bot"), 300);
}

document.addEventListener("DOMContentLoaded", () => {
  initBgParticles(); initNav(); initHeroStats(); renderPipelineRail(); renderAxisGrid();
  renderOverviewCharts(); renderLeaderboard(); initLeaderboardControls(); renderTrapsGrid(); initCopilot();
  document.getElementById("modal-close").addEventListener("click", closeCandidateModal);
  document.getElementById("candidate-modal-backdrop").addEventListener("click", e => { if (e.target.id === "candidate-modal-backdrop") closeCandidateModal(); });
});
