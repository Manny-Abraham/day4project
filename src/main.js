import seed from "../convex/seed.json" with { type: "json" };
import { recommend, EMOTION_TAGS, normalizeText, normalizeDesired, templateWhy, badges } from "../lib/recommend.js";

let desired = "";
let current = "";
let recommendation = { results: [], empty: false, degraded: false };
let loosenStep = 0;
const app = document.getElementById("app");
const FAMILY = { "Tired/Relaxed": ["Happy", "Tired/Relaxed"], Happy: ["Happy", "Excited"] };

function poster(m, i) {
  if (m.posterPath) return `<img src="${m.posterPath}" alt="Poster for ${m.title}" class="h-28 w-full object-cover rounded" loading="lazy">`;
  return `<div class="h-28 bg-gradient-to-br from-indigo-200 to-pink-200 rounded flex items-center justify-center text-xs" role="img" aria-label="Poster placeholder for ${m.title}">poster ${i + 1}</div>`;
}

function render() {
  app.innerHTML = `<div class="max-w-5xl mx-auto p-4">
    <div class="bg-white rounded p-3 shadow flex flex-wrap gap-2 items-center">
      <input id="cur" class="border rounded px-2 py-1 w-64" maxlength="280" placeholder="Current feeling (optional)" value="${current.replace(/"/g, "&quot;")}">
      <div class="flex gap-1 flex-wrap" aria-label="Current quick picks">${EMOTION_TAGS.map((t) => `<button data-c="${t}" class="cur-chip border rounded-full px-2 py-0.5 text-xs">${t}</button>`).join("")}</div>
      <div class="flex gap-1 flex-wrap" aria-label="Desired picks">${EMOTION_TAGS.map((t) => `<button data-d="${t}" class="des-chip border rounded-full px-2 py-0.5 text-xs ${desired === t ? "bg-black text-white" : ""}">${t}</button>`).join("")}</div>
      <button id="go" class="bg-black text-white rounded px-3 py-1" ${desired ? "" : "disabled opacity-50"}>Recommend</button>
      ${recommendation.degraded && recommendation.results.length ? `<span class="text-xs bg-orange-200 px-2 py-1 rounded">degraded fallback</span>` : ""}
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">${recommendation.results.map((m, i) => `
      <div class="bg-white rounded shadow p-2" tabindex="0">
        ${poster(m, i)}
        <p class="font-bold mt-1">${m.title} <span class="font-normal">(${m.year})</span></p>
        <p class="text-xs">${m.genres.join("/")} · ${badges(m).join(" · ")}</p>
        <p class="text-xs mt-1 italic">“${m.whyMatch}”</p>
        ${m.trailerYouTubeKey ? `<a class="text-xs underline" href="https://www.youtube.com/watch?v=${m.trailerYouTubeKey}" target="_blank" rel="noreferrer">Trailer ↗</a>` : ""}
      </div>`).join("")}</div>
    ${recommendation.empty ? `<div class="mt-3 bg-white rounded p-3 shadow"><p class="text-sm">No tight matches ≥ 7.0. <button id="loose" class="underline">${loosenStep === 0 ? "Loosen to 6.5 + retry" : "Try same family + retry"}</button></p></div>` : ""}
    <footer class="text-xs mt-4">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>
  </div>`;
  app.querySelectorAll(".des-chip").forEach((b) => (b.onclick = () => { desired = b.dataset.d; render(); }));
  app.querySelectorAll(".cur-chip").forEach((b) => (b.onclick = () => { current = b.dataset.c; render(); }));
  app.querySelector("#cur").oninput = (e) => (current = e.target.value);
  const go = app.querySelector("#go");
  if (go) go.onclick = () => {
    recommendation = recommend(seed.movies, { desiredTag: normalizeDesired(desired), currentText: normalizeText(current) });
    loosenStep = 0;
    render();
  };
  const looseBtn = app.querySelector("#loose");
  if (looseBtn) looseBtn.onclick = () => {
    loosenStep += 1;
    if (loosenStep === 1) {
      recommendation = recommend(seed.movies, { desiredTag: normalizeDesired(desired), currentText: current, minRating: 6.5 });
    } else {
      const fam = FAMILY[desired] ?? [desired];
      const pool = seed.movies
        .filter((m) => (m.desiredTags ?? []).some((t) => fam.includes(t)) && m.voteAverage >= 6.5 && (m.voteCount ?? 0) >= 50)
        .sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount)
        .slice(0, 5);
      recommendation = { results: pool.map((m) => ({ ...m, whyMatch: templateWhy(current, desired) })), empty: pool.length === 0, degraded: true };
    }
    render();
  };
}
render();
