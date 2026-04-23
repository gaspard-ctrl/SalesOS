#!/usr/bin/env node
// Mesure la taille en tokens du systemPrompt de app/api/deals/score/route.ts
// pour vérifier qu'il dépasse le seuil de prompt caching d'Anthropic.
//
// Seuils cache (min tokens) : Haiku 4.5 / Opus = 4096, Sonnet = 2048.
// Usage : node scripts/count-score-prompt.mjs

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Charge .env.local pour récupérer ANTHROPIC_API_KEY
const envPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY absent (vérifié dans env + .env.local)");
  process.exit(1);
}

// Extrait le template literal systemPrompt
const srcPath = path.join(repoRoot, "app/api/deals/score/route.ts");
const src = fs.readFileSync(srcPath, "utf8");
const m = src.match(/const systemPrompt = `([\s\S]*?)`;/);
if (!m) { console.error("❌ systemPrompt introuvable dans route.ts"); process.exit(1); }

// Remplace les interpolations avec les valeurs du modèle 'generic' (cas le plus commun)
const filled = m[1]
  .replace(/\$\{model\}/g, "generic")
  .replace(/\$\{maxes\.authority\}/g, "20")
  .replace(/\$\{maxes\.budget\}/g, "15")
  .replace(/\$\{maxes\.timeline\}/g, "10")
  .replace(/\$\{maxes\.business_need\}/g, "15")
  .replace(/\$\{maxes\.engagement\}/g, "25")
  .replace(/\$\{maxes\.strategic_fit\}/g, "5")
  .replace(/\$\{maxes\.competition\}/g, "10")
  .replace(/\$\{names\[0\]\}/g, "Authority & Buying Group")
  .replace(/\$\{names\[1\]\}/g, "Budget Clarity")
  .replace(/\$\{names\[2\]\}/g, "Timeline")
  .replace(/\$\{names\[3\]\}/g, "Business Need")
  .replace(/\$\{names\[4\]\}/g, "Engagement & Momentum")
  .replace(/\$\{names\[5\]\}/g, "Strategic Fit")
  .replace(/\$\{names\[6\]\}/g, "Compétition");

const client = new Anthropic();

const models = [
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", threshold: 4096 },
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5", threshold: 2048 },
];

console.log(`Taille caractères du systemPrompt : ${filled.length}`);
console.log("");

for (const model of models) {
  const res = await client.messages.countTokens({
    model: model.id,
    system: filled,
    messages: [{ role: "user", content: "x" }],
  });
  const tokens = res.input_tokens - 1; // retire le "x" du user message (≈1 token)
  const ok = tokens >= model.threshold;
  const icon = ok ? "✅" : "❌";
  const margin = tokens - model.threshold;
  console.log(`${icon} ${model.name.padEnd(12)} — ${tokens} tokens (seuil ${model.threshold}, marge ${margin >= 0 ? "+" : ""}${margin})`);
}
