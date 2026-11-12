"use strict";
const express = require("express");
const path = require("path");

const {
  GEMINI_API_KEY, OPENAI_API_KEY, GOOGLE_CSE_KEY, GOOGLE_CSE_ID,
  GEMINI_MODEL = "gemini-2.5-flash", OPENAI_MODEL = "gpt-4o-mini", PORT = 3000,
} = process.env;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" });
  next();
});
// Sirf ye files public hain (server.js aur secrets kabhi serve nahi hote)
const PAGES = { "/": "index.html", "/robots.txt": "robots.txt", "/sitemap.xml": "sitemap.xml" };
Object.entries(PAGES).forEach(([url, file]) => app.get(url, (_q, res) => res.sendFile(path.join(__dirname, file))));

// Simple in-memory rate limit: 10 requests / minute / IP
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now(), ip = req.ip;
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (list.length >= 10) return res.status(429).json({ error: "Bahut zyada requests. 1 minute baad try kijiye." });
  list.push(now); hits.set(ip, list); next();
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

const MODES = {
  plain: (q) => q,
  deep: (q) => `Deep research karo: ${q}\n\nFormat: 1) overview 2) key facts aur latest data 3) alag-alag nazariye 4) nateeja. Important claims ke saath source batao.`,
  summary: (q) => `Is topic ko 5 key points mein summarize karo: ${q}`,
  compare: (q) => `Pros aur cons ki comparison do aur balanced nateeja likho: ${q}`,
  fact: (q) => `Is claim ko fact-check karo (sach / jhoot / adha-sach) saboot ke saath: ${q}`,
  simple: (q) => `Isse bahut aasan Hindi mein example ke saath samjhao: ${q}`,
};

async function post(url, headers, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  return data;
}

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY set nahi hai");
  const d = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    { "x-goog-api-key": GEMINI_API_KEY },
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  return d.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "(khaali jawab)";
}

async function askOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY set nahi hai");
  const d = await post(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${OPENAI_API_KEY}` },
    { model: OPENAI_MODEL, messages: [{ role: "user", content: prompt }] }
  );
  return d.choices?.[0]?.message?.content || "(khaali jawab)";
}

async function googleSearch(q) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_ID) throw new Error("Google Search keys set nahi hain");
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.search = new URLSearchParams({ key: GOOGLE_CSE_KEY, cx: GOOGLE_CSE_ID, q, num: "6" });
  const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return (d.items || []).map((i) => ({ title: i.title, link: i.link, snippet: i.snippet }));
}

const unwrap = (s) => s.status === "fulfilled" ? { ok: true, data: s.value } : { ok: false, error: s.reason.message };

app.post("/api/research", rateLimit, async (req, res) => {
  const query = String(req.body?.query || "").trim().slice(0, 2000);
  const mode = MODES[req.body?.mode] ? req.body.mode : "plain";
  if (!query) return res.status(400).json({ error: "Sawal khaali hai." });

  const prompt = MODES[mode](query);
  const [g, o, w] = await Promise.allSettled([askGemini(prompt), askOpenAI(prompt), googleSearch(query)]);
  const out = { gemini: unwrap(g), chatgpt: unwrap(o), google: unwrap(w), summary: null };

  const answers = [["Gemini", out.gemini], ["ChatGPT", out.chatgpt]].filter(([, x]) => x.ok);
  if (answers.length) {
    const web = out.google.ok ? "\n\nGoogle web results:\n" + out.google.data.map((i) => `- ${i.title}: ${i.snippet} (${i.link})`).join("\n") : "";
    const synth = `Neeche ek research sawal ke alag-alag AI jawab hain. Inhe milakar ek saaf, accurate Hindi summary banao: pehle common points, phir jahan jawab alag hain wahan farq, aur end mein final nateeja. Agar kisi claim par shak ho to bata do.\n\nSawal: ${query}\n\n` +
      answers.map(([n, x]) => `### ${n}\n${x.data}`).join("\n\n") + web;
    try { out.summary = { ok: true, data: GEMINI_API_KEY ? await askGemini(synth) : await askOpenAI(synth) }; }
    catch (e) { out.summary = { ok: false, error: e.message }; }
  }
  res.json(out);
});

app.get("/healthz", (_, res) => res.send("ok"));
app.listen(PORT, () => console.log(`Research Hub chal raha hai: http://localhost:${PORT}`));
