/**
 * Hand-rolled, dependency-free SVG charts. Each renders into a container and
 * wires its own interactions: donut + bars support hover tooltips and
 * click-to-filter; the line chart supports hover tooltips and (via the caller)
 * a zoomable time range.
 */
import { esc } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";

function tip(container) {
  let el = container.querySelector(".chart-tip");
  if (!el) {
    el = document.createElement("div");
    el.className = "chart-tip";
    container.appendChild(el);
  }
  return el;
}

function showTip(container, html, x, y) {
  const t = tip(container);
  t.innerHTML = html;
  t.style.left = x + "px";
  t.style.top = y + "px";
  t.style.opacity = "1";
}
function hideTip(container) { const t = container.querySelector(".chart-tip"); if (t) t.style.opacity = "0"; }

/* ---- Donut: source mix ------------------------------------------------- */
export function donut(container, data, { onSelect } = {}) {
  container.classList.add("chart-wrap");
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 200, r = 80, cx = size / 2, cy = size / 2, sw = 26;
  let angle = -Math.PI / 2;

  const seg = (d) => {
    const frac = d.value / total;
    const a0 = angle, a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return `<path class="donut-seg" data-label="${esc(d.label)}" d="M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}"
      fill="none" stroke="${d.color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${size} ${size}" style="max-width:220px;margin:0 auto">
      ${data.filter((d) => d.value > 0).map(seg).join("")}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--text)" font-size="26" font-weight="800">${total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="var(--text-3)" font-size="11">items</text>
    </svg>
    <div class="legend">
      ${data.map((d) => `<div class="li" data-label="${esc(d.label)}">
        <span class="dot" style="background:${d.color}"></span>${esc(d.label)} <span class="muted-3">${d.value}</span></div>`).join("")}
    </div>`;

  const wire = (el) => {
    const label = el.dataset.label;
    el.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      const d = data.find((x) => x.label === label);
      showTip(container, `<strong>${esc(label)}</strong> · ${d.value} (${Math.round((d.value / total) * 100)}%)`,
        e.clientX - rect.left, e.clientY - rect.top);
    });
    el.addEventListener("mouseleave", () => hideTip(container));
    if (onSelect) { el.style.cursor = "pointer"; el.addEventListener("click", () => onSelect(label)); }
  };
  container.querySelectorAll(".donut-seg, .legend .li").forEach(wire);
}

/* ---- Bars: topic mix (sortable) ---------------------------------------- */
export function bars(container, data, { onSelect } = {}) {
  container.classList.add("chart-wrap");
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 30, w = 320, labelW = 96, barW = w - labelW - 36;

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${w} ${data.length * rowH + 6}">
      ${data.map((d, i) => {
        const y = i * rowH + 4, bw = (d.value / max) * barW;
        return `<g class="bar-row" data-label="${esc(d.label)}">
          <text x="0" y="${y + 15}" fill="var(--text-2)" font-size="12">${esc(d.label.slice(0, 12))}</text>
          <rect x="${labelW}" y="${y + 4}" width="${barW}" height="14" rx="7" fill="var(--surface-2)"/>
          <rect class="bar-rect" x="${labelW}" y="${y + 4}" width="${bw}" height="14" rx="7" fill="var(--primary)"/>
          <text x="${labelW + bw + 6}" y="${y + 15}" fill="var(--text-3)" font-size="11">${d.value}</text>
        </g>`;
      }).join("")}
    </svg>`;

  container.querySelectorAll(".bar-row").forEach((g) => {
    const label = g.dataset.label;
    g.style.cursor = onSelect ? "pointer" : "default";
    g.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      const d = data.find((x) => x.label === label);
      showTip(container, `<strong>${esc(label)}</strong> · ${d.value} mentions`, e.clientX - rect.left, e.clientY - rect.top);
    });
    g.addEventListener("mouseleave", () => hideTip(container));
    if (onSelect) g.addEventListener("click", () => onSelect(label));
  });
}

/* ---- Activity over time: vertical bars with a real x/y axis ------------ */
export function line(container, points) {
  container.classList.add("chart-wrap");
  const w = 560, h = 200;
  const padL = 30, padR = 12, padT = 12, padB = 28;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const max = Math.max(...points.map((p) => p.value), 1);
  const n = points.length || 1;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.6, 34);
  const baseY = padT + plotH;

  // y gridlines at 0, half, max
  const yticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const yOf = (v) => baseY - (v / max) * plotH;
  // show ~6 evenly-spaced x labels so they don't collide or overlap
  const labelEvery = Math.max(1, Math.round(n / 6));

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      ${yticks.map((v) => `
        <line x1="${padL}" y1="${yOf(v)}" x2="${w - padR}" y2="${yOf(v)}"
              stroke="var(--border)" stroke-width="1"/>
        <text x="${padL - 6}" y="${yOf(v) + 4}" text-anchor="end" fill="var(--text-3)" font-size="10">${v}</text>
      `).join("")}
      ${points.map((p, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const bh = (p.value / max) * plotH;
        const showLbl = i % labelEvery === 0; // evenly spaced; no forced last (avoids overlap)
        return `<g class="bar-col" data-i="${i}">
          <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent"/>
          <rect class="bar-rect" x="${x}" y="${baseY - bh}" width="${barW}" height="${bh}" rx="4" fill="var(--primary)"/>
          ${showLbl ? `<text x="${padL + i * slot + slot / 2}" y="${h - 9}" text-anchor="middle" fill="var(--text-3)" font-size="10">${esc(p.label)}</text>` : ""}
        </g>`;
      }).join("")}
      <line x1="${padL}" y1="${baseY}" x2="${w - padR}" y2="${baseY}" stroke="var(--border-2)" stroke-width="1"/>
    </svg>`;

  container.querySelectorAll(".bar-col").forEach((g) => {
    const i = +g.dataset.i;
    g.style.cursor = "default";
    g.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      showTip(container, `<strong>${points[i].value}</strong> item${points[i].value === 1 ? "" : "s"} · ${esc(points[i].label)}`,
        e.clientX - rect.left, e.clientY - rect.top);
    });
    g.addEventListener("mouseleave", () => hideTip(container));
  });
}
