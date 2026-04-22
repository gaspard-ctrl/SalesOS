import { createHash } from "crypto";

export const BUSINESS_CONTEXT = {
  company: "Coachello — B2B leadership coaching platform (human coaches + AI)",
  audience: [
    "HR leaders",
    "People / Talent VPs",
    "L&D directors",
    "Chief People Officers",
    "CHROs in scaling tech / enterprise companies",
    "Heads of Learning & Development",
  ],
  coreActivities: [
    "1:1 executive and leadership coaching for managers",
    "Group coaching programs for leadership teams",
    "AI-augmented coaching (chatbot + human coaches)",
    "Manager development and L&D programs at scale",
    "Coaching ROI measurement for enterprise HR",
  ],
  relevantTopics: [
    "manager effectiveness",
    "leadership development",
    "executive coaching",
    "coaching ROI",
    "L&D strategy",
    "employee engagement",
    "high performing teams",
    "burnout prevention for managers",
    "AI in HR / people ops",
    "executive presence",
    "psychological safety",
    "feedback culture",
    "hybrid leadership",
    "first-time managers / new managers",
    "coaching culture",
    "talent development",
    "performance management",
    "360 feedback",
    "succession planning",
    "team coaching",
  ],
  excludedTopics: [
    "branded queries (Coachello brand name, company URLs, competitor names)",
    "employee-side self-help (layoff survivor syndrome, career advice for individuals, personal recovery)",
    "HR theory / terminology lookups with no buyer intent (what is X definition, academic summaries)",
    "listicles / generic lifestyle content (bucket lists, icebreaker questions, quizzes)",
    "life coaching for teens / kids / personal growth",
    "health / wellness / yoga / meditation coaching",
    "sports coaching or athletic training",
    "career coaching for job seekers / students",
    "financial or business coaching for solo entrepreneurs",
    "relationship / dating / parenting coaching",
    "therapy / clinical psychology",
    "certification programs to become a coach",
    "spiritual / religious coaching",
    "weight loss / nutrition coaching",
  ],
  tone: "B2B HR/L&D buyer intent — NOT consumer self-help, NOT generic HR curiosity, NOT employee-side content",
} as const;

export const BUSINESS_CONTEXT_HASH = createHash("sha256")
  .update(JSON.stringify(BUSINESS_CONTEXT))
  .digest("hex")
  .slice(0, 16);

export const BUSINESS_CONTEXT_PROMPT_BLOCK = `
## Coachello business context (filter applies)
- Company: ${BUSINESS_CONTEXT.company}
- Target buyers: ${BUSINESS_CONTEXT.audience.join(", ")}
- Core offerings: ${BUSINESS_CONTEXT.coreActivities.join("; ")}
- Relevant topics (in-market): ${BUSINESS_CONTEXT.relevantTopics.join(", ")}
- EXPLICITLY EXCLUDE (not Coachello's market): ${BUSINESS_CONTEXT.excludedTopics.join(", ")}
- Tone: ${BUSINESS_CONTEXT.tone}
`.trim();
