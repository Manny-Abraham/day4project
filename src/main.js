import seed from "../convex/seed.json" with { type: "json" };
import { recommend, EMOTION_TAGS, normalizeText, normalizeDesired } from "../lib/recommend.js";

let desired = "";
let current = "";
let out = { results: [], empty: false };
let loosened = false;
const app = document.getElementById("app");

function render() {
  app.innerHTML = `<div class="max-w-5xl mx-auto p-4">
    <div class="bg-white rounded p-3 shadow flex flex-wrap gap-2 items-center">
      <input id="cur" class="border rounded px-2 py-1 w-64" maxlength="280" placeholder="Current feeling (optional)" value="${current.replace(/"/g, "&quot;")}">
      ${EMOTION_TAGS.map((t) => `<button data-d="${t}" class="chip border rounded-full px-2 py-0.5 text-xs ${desired === t ? "bg-black text-white" : ""}">${t}</button>`).join("")}
      <button id="go" class="bg-black text-white rounded px-3 py-1" ${desired ? "" : "disabled opacity-50"}>Recommend</button>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">${out.results.map((m) => `
      <div class="bg-white rounded shadow p-2" tabindex="0">
        <div class="h-28 bg-gradient-to-br from-indigo-200 to-pink-200 rounded flex items-center justify-center text-xs" role="img" aria-label="Poster for ${m.title}">${m.title}</div>
        <p class="font-bold mt-1">${m.title} <span class="font-normal">(${m.year})</span></p>
        <p class="text-xs">${m.genres.join("/")} · ★ ${m.voteAverage}</p>
        <p class="text-xs italic">“${m.whyMatch}”</p>
      </div>`).join("")}</div>
    ${out.empty ? `<div class="mt-3 bg-white rounded p-3 shadow"><p class="text-sm">No tight matches ≥ 7.0. <button id="loose" class="underline">Loosen to 6.5 + retry</button></p></div>` : ""}
    <footer class="text-xs mt-4">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>
  </div>`;
  app.querySelectorAll(".chip").forEach((b) => (b.onclick = () => { desired = b.dataset.d; render(); }));
  app.querySelector("#cur").oninput = (e) => (current = e.target.value);
  const go = app.querySelector("#go");
  if (go) go.onclick = () => {
    const tag = normalizeDesired(desired);
    out = recommend(seed.movies, { desiredTag: tag, currentText: normalizeText(current) });
    loosened = false;
    render();
  };
  const loose = app.querySelector("#loose");
  if (loose) loose.onclick = () => {
    out = recommend(seed.movies, { desiredTag: normalizeDesired(desired), currentText: current, minRating: 6.5 });
    loosened = true;
    render();
  };
}
render();
