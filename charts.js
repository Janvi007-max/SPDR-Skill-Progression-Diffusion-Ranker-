const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) { const el = document.createElementNS(SVG_NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }

function showTooltip(evt, html) {
  let tip = document.getElementById("global-tooltip");
  if (!tip) { tip = document.createElement("div"); tip.id = "global-tooltip"; tip.className = "chart-tooltip"; document.body.appendChild(tip); }
  tip.innerHTML = html; tip.classList.add("show");
  tip.style.left = Math.min(evt.clientX + 16, window.innerWidth - 240) + "px";
  tip.style.top = (evt.clientY + 10) + "px";
}
function hideTooltip() { const t = document.getElementById("global-tooltip"); if (t) t.classList.remove("show"); }

function renderScatterChart(hostId, populationSample, top100) {
  const host = document.getElementById(hostId); host.innerHTML = "";
  const W = host.clientWidth || 560, H = 360, pad = { l: 44, r: 18, t: 18, b: 38 };
  const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const sx = v => pad.l + v * plotW, sy = v => pad.t + (1 - v) * plotH;
  for (let g = 0; g <= 1.0001; g += 0.25) {
    svg.appendChild(svgEl("line", { x1: sx(g), x2: sx(g), y1: pad.t, y2: H - pad.b, stroke: "rgba(255,255,255,0.05)" }));
    svg.appendChild(svgEl("line", { x1: pad.l, x2: W - pad.r, y1: sy(g), y2: sy(g), stroke: "rgba(255,255,255,0.05)" }));
    const lx = svgEl("text", { x: sx(g), y: H - pad.b + 16, fill: "#5C5F70", "font-size": 10, "text-anchor": "middle" }); lx.textContent = g.toFixed(2); svg.appendChild(lx);
    const ly = svgEl("text", { x: pad.l - 8, y: sy(g) + 3, fill: "#5C5F70", "font-size": 10, "text-anchor": "end" }); ly.textContent = g.toFixed(2); svg.appendChild(ly);
  }
  svg.appendChild(svgEl("line", { x1: sx(0), y1: sy(0), x2: sx(1), y2: sy(1), stroke: "rgba(255,255,255,0.14)", "stroke-dasharray": "4 4" }));
  const xl = svgEl("text", { x: pad.l + plotW/2, y: H-6, fill:"#8C90A3", "font-size":11, "text-anchor":"middle" }); xl.textContent="Current Fit"; svg.appendChild(xl);
  const yl = svgEl("text", { x:14, y: pad.t+plotH/2, fill:"#8C90A3", "font-size":11, "text-anchor":"middle", transform:`rotate(-90 14 ${pad.t+plotH/2})` }); yl.textContent="Future Fit (6mo)"; svg.appendChild(yl);

  (populationSample||[]).forEach(d => {
    const c = svgEl("circle", { cx: sx(d.current_fit), cy: sy(d.future_fit), r: 2.6, fill: "rgba(124,157,255,0.28)" });
    c.addEventListener("mousemove", e => showTooltip(e, `<strong>${d.title}</strong>${(d.years_experience||0).toFixed(1)} yrs · ${d.current_fit.toFixed(2)} → ${d.future_fit.toFixed(2)}`));
    c.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(c);
  });
  (top100||[]).forEach(d => {
    const c = svgEl("circle", { cx: sx(d.current_fit), cy: sy(d.future_fit), r: d.rank<=10?5.5:4, fill: d.rank<=10?"#F472B6":"#A78BFA", stroke:"rgba(255,255,255,0.5)", "stroke-width":0.6, opacity:0.92 });
    c.style.cursor = "pointer";
    c.addEventListener("mousemove", e => showTooltip(e, `<strong>#${d.rank} ${d.name}</strong>${d.title}<br>${d.current_fit.toFixed(2)} → ${d.future_fit.toFixed(2)}`));
    c.addEventListener("mouseleave", hideTooltip);
    c.addEventListener("click", () => openCandidateModal(d.candidate_id));
    svg.appendChild(c);
  });
  host.appendChild(svg);
  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;gap:18px;margin-top:8px;font-size:11px;color:#8C90A3;flex-wrap:wrap;";
  legend.innerHTML = `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(124,157,255,0.5);margin-right:5px;"></span>Eligible pool (sample)</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#A78BFA;margin-right:5px;"></span>Top 100</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F472B6;margin-right:5px;"></span>Top 10</span>`;
  host.appendChild(legend);
}

function renderFunnelChart(hostId, meta) {
  const host = document.getElementById(hostId); host.innerHTML = "";
  const stages = [
    { label: "Total candidates", value: meta.total_candidates, color: "#5C5F70" },
    { label: "Passed eligibility gate", value: meta.eligible_candidates, color: "#7C9DFF" },
    { label: "Flagged honeypot/implausible", value: meta.honeypot_flagged, color: "#FB7185" },
    { label: "Ghost candidates (low availability)", value: meta.ghost_candidates, color: "#FBBF24" },
    { label: "Final shortlist", value: meta.top_n, color: "#34D399" },
  ];
  const maxV = meta.total_candidates;
  const wrap = document.createElement("div"); wrap.style.cssText = "display:flex;flex-direction:column;gap:14px;padding-top:6px;";
  stages.forEach(s => {
    const pct = (s.value / maxV) * 100;
    const row = document.createElement("div");
    row.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;color:#C7CAD6;margin-bottom:5px;">
      <span>${s.label}</span><span style="font-family:'JetBrains Mono';color:${s.color};font-weight:600;">${s.value.toLocaleString()}</span></div>
      <div style="height:10px;border-radius:6px;background:rgba(255,255,255,0.05);overflow:hidden;">
      <div style="height:100%;width:${Math.max(pct,0.6)}%;background:${s.color};border-radius:6px;"></div></div>`;
    wrap.appendChild(row);
  });
  host.appendChild(wrap);
}

function renderSkillBars(hostEl, current, future, target, axisLabels, axes) {
  hostEl.innerHTML = "";
  axes.forEach(axis => {
    const cur = current[axis]||0, fut = future[axis]||0, tgt = target[axis]||0;
    const row = document.createElement("div"); row.className = "skill-bar-row";
    row.innerHTML = `<div class="skill-bar-label">${axisLabels[axis]||axis}</div>
      <div class="skill-bar-track">
        <div class="skill-bar-current" style="width:${cur*100}%"></div>
        <div class="skill-bar-target-marker" style="left:${tgt*100}%"></div>
        <div class="skill-bar-future-marker" style="left:${cur*100}%"></div>
      </div>
      <div class="skill-bar-vals">${cur.toFixed(2)} → ${fut.toFixed(2)}</div>`;
    hostEl.appendChild(row);
    setTimeout(() => { row.querySelector(".skill-bar-future-marker").style.left = (fut*100)+"%"; }, 80);
  });
}

function renderDiffusionAnimation(hostEl, current, future, futureStd, target, axes, axisLabels) {
  hostEl.innerHTML = "";
  const deltas = axes.map(a => ({ a, d: Math.abs((future[a]||0) - (current[a]||0)) }));
  deltas.sort((x,y) => y.d - x.d);
  const axA = deltas[0].a, axB = deltas[1].a;
  const W = hostEl.clientWidth || 460, H = 300, pad = 34;
  const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const sx = v => pad + v*(W-2*pad), sy = v => H-pad - v*(H-2*pad);
  for (let g=0; g<=1.001; g+=0.2) {
    svg.appendChild(svgEl("line", { x1:sx(g), x2:sx(g), y1:pad, y2:H-pad, stroke:"rgba(255,255,255,0.04)" }));
    svg.appendChild(svgEl("line", { x1:pad, x2:W-pad, y1:sy(g), y2:sy(g), stroke:"rgba(255,255,255,0.04)" }));
  }
  const xlabel = svgEl("text", { x:W/2, y:H-8, fill:"#8C90A3", "font-size":10.5, "text-anchor":"middle" }); xlabel.textContent = axisLabels[axA]||axA; svg.appendChild(xlabel);
  const ylabel = svgEl("text", { x:10, y:H/2, fill:"#8C90A3", "font-size":10.5, "text-anchor":"middle", transform:`rotate(-90 10 ${H/2})` }); ylabel.textContent = axisLabels[axB]||axB; svg.appendChild(ylabel);

  const tx = sx(target[axA]||0), ty = sy(target[axB]||0);
  svg.appendChild(svgEl("circle", { cx:tx, cy:ty, r:14, fill:"none", stroke:"rgba(255,255,255,0.25)", "stroke-dasharray":"3 3" }));
  const tl = svgEl("text", { x:tx, y:ty-20, fill:"#C7CAD6", "font-size":10, "text-anchor":"middle" }); tl.textContent = "role target"; svg.appendChild(tl);
  svg.appendChild(svgEl("circle", { cx:tx, cy:ty, r:3.5, fill:"#fff" }));

  const x0 = sx(current[axA]||0), y0 = sy(current[axB]||0);
  const x1 = sx(future[axA]||0), y1 = sy(future[axB]||0);
  const stdA = (futureStd[axA]||0.02) * (W-2*pad), stdB = (futureStd[axB]||0.02) * (H-2*pad);

  for (let i=0;i<24;i++) {
    const jx = (Math.random()-0.5)*2*stdA, jy = (Math.random()-0.5)*2*stdB;
    const ex = x1+jx, ey = y1+jy;
    const mx = x0+(ex-x0)*0.5+(Math.random()-0.5)*22, my = y0+(ey-y0)*0.5+(Math.random()-0.5)*22;
    svg.appendChild(svgEl("path", { d:`M ${x0} ${y0} Q ${mx} ${my} ${ex} ${ey}`, fill:"none", stroke:"rgba(167,139,250,0.22)", "stroke-width":1 }));
  }
  const meanPath = svgEl("path", { d:`M ${x0} ${y0} Q ${(x0+x1)/2} ${(y0+y1)/2-8} ${x1} ${y1}`, fill:"none", stroke:"#F472B6", "stroke-width":2.4, "stroke-linecap":"round" });
  svg.appendChild(meanPath);
  svg.appendChild(svgEl("ellipse", { cx:x1, cy:y1, rx:Math.max(stdA,6), ry:Math.max(stdB,6), fill:"rgba(244,114,182,0.10)", stroke:"rgba(244,114,182,0.3)" }));
  svg.appendChild(svgEl("circle", { cx:x0, cy:y0, r:5, fill:"#7C9DFF", stroke:"#0a0a12", "stroke-width":1.5 }));
  svg.appendChild(svgEl("circle", { cx:x1, cy:y1, r:5.5, fill:"#F472B6", stroke:"#0a0a12", "stroke-width":1.5 }));
  hostEl.appendChild(svg);
  meanPath.style.strokeDasharray = "400"; meanPath.style.strokeDashoffset = "400";
  meanPath.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)";
  setTimeout(() => { meanPath.style.strokeDashoffset = "0"; }, 100);
}

function renderHeroOrb(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const W=360,H=360,cx=W/2,cy=H/2;
  const svg = svgEl("svg", { width:"100%", height:"100%", viewBox:`0 0 ${W} ${H}` });
  const defs = svgEl("defs", {});
  const grad = svgEl("radialGradient", { id:"orbGrad", cx:"50%", cy:"50%", r:"50%" });
  grad.appendChild(svgEl("stop", { offset:"0%", "stop-color":"#C49CFF", "stop-opacity":"0.9" }));
  grad.appendChild(svgEl("stop", { offset:"100%", "stop-color":"#7C9DFF", "stop-opacity":"0" }));
  defs.appendChild(grad); svg.appendChild(defs);
  for (let r=60;r<=150;r+=30) svg.appendChild(svgEl("circle", { cx,cy,r, fill:"none", stroke:"rgba(255,255,255,0.06)" }));
  svg.appendChild(svgEl("circle", { cx,cy, r:26, fill:"url(#orbGrad)" }));
  svg.appendChild(svgEl("circle", { cx,cy, r:4, fill:"#fff" }));
  const N=50;
  for (let i=0;i<N;i++) {
    const angle = (i/N)*Math.PI*2, startR = 150;
    const sxp = cx+Math.cos(angle)*startR, syp = cy+Math.sin(angle)*startR;
    const dur = 3+Math.random()*4, delay = Math.random()*4, targetR = 26+Math.random()*10;
    const exp = cx+Math.cos(angle+(Math.random()-0.5))*targetR, eyp = cy+Math.sin(angle+(Math.random()-0.5))*targetR;
    const dot = svgEl("circle", { r:1.6+Math.random()*1.2, fill: i%4===0?"#F472B6":"#A78BFA", opacity:0.75 });
    dot.appendChild(svgEl("animate", { attributeName:"cx", values:`${sxp};${exp};${sxp}`, dur:`${dur}s`, begin:`${delay}s`, repeatCount:"indefinite" }));
    dot.appendChild(svgEl("animate", { attributeName:"cy", values:`${syp};${eyp};${syp}`, dur:`${dur}s`, begin:`${delay}s`, repeatCount:"indefinite" }));
    dot.appendChild(svgEl("animate", { attributeName:"opacity", values:"0;0.85;0.85;0", dur:`${dur}s`, begin:`${delay}s`, repeatCount:"indefinite" }));
    svg.appendChild(dot);
  }
  host.innerHTML = ""; host.appendChild(svg);
}

function initBgParticles() {
  const canvas = document.getElementById("bg-particles"); if (!canvas) return;
  const ctx = canvas.getContext("2d"); let W,H,particles;
  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize(); window.addEventListener("resize", resize);
  particles = Array.from({length:46}, () => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.12, vy:(Math.random()-0.5)*0.12, r:Math.random()*1.4+0.4 }));
  function tick() {
    ctx.clearRect(0,0,W,H); ctx.fillStyle = "rgba(167,139,250,0.35)";
    particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>W)p.vx*=-1; if(p.y<0||p.y>H)p.vy*=-1; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
    requestAnimationFrame(tick);
  }
  tick();
}
