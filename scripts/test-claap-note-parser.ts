// Run with: npx tsx scripts/test-claap-note-parser.ts
import { htmlToText, isClaapNote, parseClaapNote } from "../lib/claap-note-parser";

const FIXTURE_PLAIN = `Rencontre Coachello on 2026-03-30

Participants:

HORTA Claudia chorta@ponant.com

SPEDO Camille cspedo@ponant.com

Mehdi Bruneau mehdi@coachello.io

Quentin Bouche quentin@coachello.io

View meeting in Claap: https://app.claap.io/rencontre-coachello-c-9w8Ui8kSuH-gM6XpQRKY1jQ

Summary:

💡 Key takeaways

Voici un résumé des points les plus stratégiques de la réunion :

La réunion était une présentation de solution entre Coachello et Ponant. L'objectif principal était de présenter la plateforme de coaching de Coachello.

Ponant a exprimé une insatisfaction significative avec leur prestataire actuel, Simundia.

Coachello a proposé un programme de huit séances de coaching d'une heure pour les dirigeants.

✅ Action items

HORTA Claudia: organiser un rapprochement avec un client de Coachello pour Camille et un autre pour Aline.

HORTA Claudia: préparer une proposition budgétaire pour l'accompagnement de 50 dirigeants.

💬 Small talk

None

📄 Summary

Résumé détaillé de la réunion.

❓ Situation

03:14 Ponant a connu une phase d'hyper-croissance.
`;

const FIXTURE_HTML = `<p>Rencontre Coachello on 2026-03-30</p>
<p><strong>Participants:</strong></p>
<ul>
  <li>HORTA Claudia chorta@ponant.com</li>
  <li>SPEDO Camille cspedo@ponant.com</li>
</ul>
<p>View meeting in Claap: <a href="https://app.claap.io/rencontre-coachello-c-9w8Ui8kSuH-gM6XpQRKY1jQ">link</a></p>
<p><strong>Summary:</strong></p>
<p>💡 Key takeaways</p>
<p>Voici un résumé HTML de la réunion entre Coachello et Ponant.</p>
<p>✅ Action items</p>
<ul>
  <li>HORTA Claudia: préparer une proposition budgétaire.</li>
  <li>HORTA Claudia: organiser un rapprochement client.</li>
</ul>
<p>💬 Small talk</p>
<p>None</p>`;

const FIXTURE_NONE_ACTIONS = `Rencontre TestCo on 2026-04-01

View meeting in Claap: https://app.claap.io/test-meeting-abc123

Summary:

💡 Key takeaways

Some content here.

✅ Action items

None

💬 Small talk

None
`;

const NON_CLAAP_NOTE = "<p>This is just a regular HubSpot note, no Claap content.</p>";

let failures = 0;
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n[1] Plain-text fixture");
{
  const p = parseClaapNote(FIXTURE_PLAIN);
  check("title === 'Coachello'", p.title === "Coachello", `got ${JSON.stringify(p.title)}`);
  check("meetingDate === '2026-03-30'", p.meetingDate === "2026-03-30", `got ${JSON.stringify(p.meetingDate)}`);
  check(
    "claapUrl matches",
    p.claapUrl === "https://app.claap.io/rencontre-coachello-c-9w8Ui8kSuH-gM6XpQRKY1jQ",
    `got ${JSON.stringify(p.claapUrl)}`,
  );
  check("keyTakeaways non-empty", p.keyTakeaways.length > 0);
  check("keyTakeaways contains 'Coachello'", p.keyTakeaways.includes("Coachello"));
  check(
    "keyTakeaways does NOT contain 'HORTA Claudia: organiser'",
    !p.keyTakeaways.includes("HORTA Claudia: organiser"),
    "stop boundary leaked into takeaways",
  );
  check(
    "keyTakeaways does NOT contain 'Small talk'",
    !p.keyTakeaways.includes("Small talk"),
  );
  check("actionItems contains 'HORTA Claudia'", p.actionItems.includes("HORTA Claudia"));
  check(
    "actionItems contains both action lines",
    p.actionItems.includes("organiser un rapprochement") &&
      p.actionItems.includes("proposition budgétaire"),
  );
  check(
    "actionItems does NOT contain 'Small talk'",
    !p.actionItems.includes("Small talk"),
  );
  check(
    "actionItems does NOT contain '📄 Summary'",
    !p.actionItems.includes("📄") && !p.actionItems.includes("Situation"),
  );
}

console.log("\n[2] HTML fixture");
{
  check("isClaapNote(HTML) === true", isClaapNote(FIXTURE_HTML));
  const p = parseClaapNote(FIXTURE_HTML);
  check("title === 'Coachello'", p.title === "Coachello", `got ${JSON.stringify(p.title)}`);
  check("meetingDate === '2026-03-30'", p.meetingDate === "2026-03-30");
  check(
    "claapUrl matches",
    p.claapUrl === "https://app.claap.io/rencontre-coachello-c-9w8Ui8kSuH-gM6XpQRKY1jQ",
  );
  check(
    "keyTakeaways contains 'résumé HTML'",
    p.keyTakeaways.includes("résumé HTML"),
    `got: ${p.keyTakeaways}`,
  );
  check("actionItems contains 'proposition budgétaire'", p.actionItems.includes("proposition budgétaire"));
  check(
    "actionItems bullets normalized to '•'",
    p.actionItems.includes("• HORTA Claudia"),
    `got: ${p.actionItems}`,
  );
}

console.log("\n[3] Action items 'None' fixture");
{
  const p = parseClaapNote(FIXTURE_NONE_ACTIONS);
  check("actionItems === ''", p.actionItems === "", `got ${JSON.stringify(p.actionItems)}`);
  check("keyTakeaways non-empty", p.keyTakeaways.length > 0);
}

console.log("\n[4] Non-Claap note");
{
  check("isClaapNote(non-claap) === false", !isClaapNote(NON_CLAAP_NOTE));
  check(
    "isClaapNote(plain marker) === true",
    isClaapNote("<p>foo</p>View meeting in Claap: x"),
  );
}

console.log("\n[5] htmlToText preserves line breaks");
{
  const t = htmlToText("<p>line one</p><p>line two</p>");
  check("two paragraphs become two lines", t.includes("line one") && t.includes("line two") && t.includes("\n"));
}

console.log("");
if (failures > 0) {
  console.error(`✗ ${failures} assertion(s) failed`);
  process.exit(1);
} else {
  console.log("✓ all parser assertions passed");
}
