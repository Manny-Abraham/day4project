import seed from "../convex/seed.json" with { type: "json" };
import { recommend, EMOTION_TAGS, normalizeText, normalizeDesired, templateWhy, badges, quizToDesired } from "../lib/recommend.js";
import { normalizeViaJev, rankViaJev } from "../lib/jev.js";
import { applyCopy } from "../lib/copy.js";
import { mergeTranscript, voiceSupported } from "../lib/voice.js";

// Backend seam: when VITE_CONVEX_URL is set (after `npx convex dev`),
// the UI calls the deployed recommend action via anyApi (no codegen needed).
// Otherwise it runs the same rule logic locally against the bundled seed.
const CONVEX_URL = import.meta.env?.VITE_CONVEX_URL;
let convexClient = null;
async function backendRecommend(args) {
  if (!CONVEX_URL) return null;
  try {
    if (!convexClient) {
      const [{ ConvexHttpClient }, { anyApi }] = await Promise.all([
        import("convex/browser"),
        import("convex/server"),
      ]);
      convexClient = new ConvexHttpClient(CONVEX_URL);
      convexClient.anyApi = anyApi;
    }
    return await convexClient.action(convexClient.anyApi.recommend.recommend, args);
  } catch {
    return null;
  }
}

let desired = "";
let current = "";
let recommendation = { results: [], empty: false, degraded: false };
let loosenStep = 0;
let quizOpen = false;
const app = document.getElementById("app");
const FAMILY = { "Tired/Relaxed": ["Happy", "Tired/Relaxed"], Happy: ["Happy", "Excited"] };
const MIC_FALLBACK = "Mic failed — type instead.";
const MIC_UNSUPPORTED = "Voice unsupported here — type instead.";

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
      <button id="mic" class="border rounded px-2 py-1" title="Dictate current feeling">Mic</button>
      <span id="micMsg" class="text-xs text-neutral-500"></span>
      <button id="quizToggle" class="border rounded px-3 py-1">Image quiz</button>
      ${recommendation.degraded && recommendation.results.length ? `<span class="text-xs bg-orange-200 px-2 py-1 rounded">degraded fallback</span>` : ""}
    ${recommendation.clarify && !recommendation.results.length ? `<p class="text-xs mt-1 text-amber-700">${recommendation.clarify}</p>` : ""}
    ${quizOpen ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2" aria-label="Image quiz">${(seed.quizOptions ?? []).map((q, i) => `<button data-i="${i}" class="quiz-pick bg-white rounded shadow p-2 text-left" tabindex="0"><div class="h-20 bg-gradient-to-br from-amber-100 to-sky-200 rounded flex items-center justify-center text-xs" role="img" aria-label="${q.label}">${q.label}</div><p class="text-xs mt-1">Pick: ${q.label}</p></button>`).join("")}</div><p class="text-xs mt-1">Skippable — chips above always work.</p>` : ""}
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
  const micBtn = app.querySelector("#mic");
  const micSay = (t) => {
    const m = app.querySelector("#micMsg");
    if (m) m.textContent = t;
  };
  if (micBtn) micBtn.onclick = () => {
    const Ctor = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    if (!voiceSupported(Ctor)) {
      micSay(MIC_UNSUPPORTED);
      return;
    }
    try {
      const rec = new Ctor();
      rec.interimResults = false;
      rec.onresult = (e) => {
        const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        current = mergeTranscript(current, t);
        render();
      };
      rec.onerror = () => micSay(MIC_FALLBACK);
      rec.start();
      micSay("Listening…");
    } catch {
      micSay(MIC_FALLBACK);
    }
  };
  const go = app.querySelector("#go");
  const quizToggle = app.querySelector("#quizToggle");
  if (quizToggle) quizToggle.onclick = () => {
    quizOpen = !quizOpen;
    render();
  };
  app.querySelectorAll(".quiz-pick").forEach((b) => (b.onclick = () => {
    const opts = seed.quizOptions ?? [];
    const picked = opts[Number(b.dataset.i)];
    const tag = quizToDesired(opts, Number(b.dataset.i));
    if (tag) {
      desired = tag;
      if (!normalizeText(current)) current = normalizeText(picked?.label ?? "");
    }
    quizOpen = false;
    render();
  }));
  if (go) go.onclick = async () => {
    const decided = normalizeViaJev(desired || current);
    const tag = decided.tag ?? normalizeDesired(desired);
    const remote = await backendRecommend({ desiredTag: tag, currentText: normalizeText(current) });
    if (remote && Array.isArray(remote.results)) {
      recommendation = { ...remote, clarify: decided.tag ? null : "Not sure which feeling — pick a chip or quiz image." };
    } else {
      const base = recommend(seed.movies, { desiredTag: tag, currentText: normalizeText(current) });
      const ranked = rankViaJev(base.results);
      const withCopy = applyCopy(ranked.ordered, normalizeText(current), tag);
      recommendation = { results: withCopy, empty: withCopy.length === 0, degraded: ranked.degraded, clarify: decided.tag ? null : "Not sure which feeling — pick a chip or quiz image." };
    }
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
      recommendation = { results: applyCopy(pool, current, desired), empty: pool.length === 0, degraded: true };
    }
    render();
  };
}
render();
