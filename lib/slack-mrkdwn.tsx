import React from "react";

// Most common Slack shortcodes seen in the Coachello leads channel.
// Unknown shortcodes fall back to the raw `:name:` text so nothing is hidden.
const EMOJI_MAP: Record<string, string> = {
  mailbox_with_mail: "📬",
  mailbox: "📫",
  email: "📧",
  envelope: "✉️",
  incoming_envelope: "📨",
  inbox_tray: "📥",
  outbox_tray: "📤",
  "star-struck": "🤩",
  star: "⭐",
  sparkles: "✨",
  fire: "🔥",
  rocket: "🚀",
  dart: "🎯",
  new: "🆕",
  bell: "🔔",
  tada: "🎉",
  eyes: "👀",
  raised_hands: "🙌",
  pray: "🙏",
  thumbsup: "👍",
  "+1": "👍",
  thumbsdown: "👎",
  "-1": "👎",
  clap: "👏",
  ok_hand: "👌",
  point_right: "👉",
  point_left: "👈",
  wave: "👋",
  muscle: "💪",
  warning: "⚠️",
  heavy_check_mark: "✔️",
  white_check_mark: "✅",
  x: "❌",
  no_entry: "⛔",
  question: "❓",
  exclamation: "❗",
  heart: "❤️",
  heart_eyes: "😍",
  grin: "😁",
  smile: "😄",
  joy: "😂",
  wink: "😉",
  thinking_face: "🤔",
  sunglasses: "😎",
  cry: "😢",
  sob: "😭",
  scream: "😱",
  confused: "😕",
  neutral_face: "😐",
  fearful: "😨",
  rofl: "🤣",
  zany_face: "🤪",
  hugging_face: "🤗",
  nerd_face: "🤓",
  face_with_monocle: "🧐",
  money_mouth_face: "🤑",
  cold_face: "🥶",
  hot_face: "🥵",
  partying_face: "🥳",
  speech_balloon: "💬",
  left_speech_bubble: "🗨️",
  thought_balloon: "💭",
  telephone: "☎️",
  iphone: "📱",
  phone: "📞",
  computer: "💻",
  chart_with_upwards_trend: "📈",
  chart_with_downwards_trend: "📉",
  bar_chart: "📊",
  chart: "💹",
  moneybag: "💰",
  dollar: "💵",
  euro: "💶",
  pound: "💷",
  credit_card: "💳",
  gem: "💎",
  briefcase: "💼",
  office: "🏢",
  factory: "🏭",
  handshake: "🤝",
  bulb: "💡",
  gear: "⚙️",
  wrench: "🔧",
  hammer: "🔨",
  toolbox: "🧰",
  mag: "🔍",
  mag_right: "🔎",
  book: "📖",
  books: "📚",
  pencil: "📝",
  pencil2: "✏️",
  memo: "📝",
  page_facing_up: "📄",
  clipboard: "📋",
  calendar: "📅",
  date: "📅",
  spiral_calendar_pad: "🗓️",
  alarm_clock: "⏰",
  hourglass: "⌛",
  hourglass_flowing_sand: "⏳",
  clock1: "🕐",
  clock2: "🕑",
  clock3: "🕒",
  earth_africa: "🌍",
  earth_americas: "🌎",
  earth_asia: "🌏",
  globe_with_meridians: "🌐",
  link: "🔗",
  paperclip: "📎",
  lock: "🔒",
  unlock: "🔓",
  key: "🔑",
  crown: "👑",
  zap: "⚡",
  sparkler: "🎇",
  boom: "💥",
  trophy: "🏆",
  medal: "🏅",
  first_place_medal: "🥇",
  second_place_medal: "🥈",
  third_place_medal: "🥉",
  robot_face: "🤖",
  alien: "👽",
  ghost: "👻",
  skull: "💀",
  bug: "🐛",
  ant: "🐜",
  spider: "🕷️",
  black_circle: "⚫",
  white_circle: "⚪",
  red_circle: "🔴",
  large_blue_circle: "🔵",
  large_green_circle: "🟢",
  large_yellow_circle: "🟡",
  large_orange_circle: "🟠",
  large_purple_circle: "🟣",
  large_brown_circle: "🟤",
};

// Drop Slack skin-tone / gender modifiers we don't map (e.g. :wave::skin-tone-2:).
function lookupEmoji(code: string): string | null {
  const normalized = code.toLowerCase().split("::")[0];
  return EMOJI_MAP[normalized] ?? null;
}

// Very small HTML sanitizer: only allow http(s) and mailto: for links.
function safeHref(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) return url;
  return null;
}

type Node = string | React.ReactElement;

function renderInline(text: string, keyPrefix: string): Node[] {
  // Order matters: links first (Slack brackets can contain pipe and url),
  // then emoji, then bold/italic/strike/code.
  const nodes: Node[] = [];
  let remaining = text;
  let i = 0;

  const pushText = (s: string) => {
    if (s.length > 0) nodes.push(s);
  };

  // 1) Extract Slack links <url|label> and <url>
  const linkRegex = /<([^<>|]+)(?:\|([^<>]*))?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const preLinkTokens: Node[] = [];
  while ((match = linkRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) preLinkTokens.push(remaining.slice(lastIndex, match.index));
    const url = match[1];
    const label = match[2] ?? url;
    const href = safeHref(url);
    if (href) {
      preLinkTokens.push(
        <a
          key={`${keyPrefix}-a-${i++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          {label}
        </a>,
      );
    } else {
      preLinkTokens.push(label);
    }
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < remaining.length) preLinkTokens.push(remaining.slice(lastIndex));

  // 2) Walk tokens — for each string piece, apply emoji + formatting
  for (const token of preLinkTokens) {
    if (typeof token !== "string") {
      nodes.push(token);
      continue;
    }

    // Emoji: :code: — only if code matches our map, otherwise leave literal
    const emojiSplit = token.split(/(:[a-z0-9_+\-]+(?::skin-tone-\d)?:)/gi);
    for (const part of emojiSplit) {
      if (!part) continue;
      const emojiMatch = /^:([a-z0-9_+\-]+)(?::skin-tone-\d)?:$/i.exec(part);
      if (emojiMatch) {
        const unicode = lookupEmoji(emojiMatch[1]);
        if (unicode) {
          nodes.push(unicode);
          continue;
        }
        // Unknown shortcode: keep as-is
        pushText(part);
        continue;
      }

      // Bold/italic/strike/code — only on plain string segments
      const formatted = applyInlineFormatting(part, `${keyPrefix}-${i++}`);
      for (const n of formatted) nodes.push(n);
    }
  }

  return nodes;
}

// Slack uses single-character delimiters on word boundaries.
function applyInlineFormatting(input: string, keyPrefix: string): Node[] {
  // Pattern: match backtick code first (it can contain * _ ~), then bold/italic/strike.
  // Approach: tokenize by regex alternation.
  const regex = /(`[^`\n]+`)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g;
  const out: Node[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = regex.exec(input)) !== null) {
    if (m.index > last) out.push(input.slice(last, m.index));
    const tok = m[0];
    const inner = tok.slice(1, -1);
    if (tok.startsWith("`")) {
      out.push(
        <code
          key={`${keyPrefix}-c-${n++}`}
          style={{ background: "#f1f1f1", padding: "0 4px", borderRadius: 3, fontFamily: "monospace", fontSize: "0.9em" }}
        >
          {inner}
        </code>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<strong key={`${keyPrefix}-b-${n++}`}>{inner}</strong>);
    } else if (tok.startsWith("_")) {
      out.push(<em key={`${keyPrefix}-i-${n++}`}>{inner}</em>);
    } else if (tok.startsWith("~")) {
      out.push(<del key={`${keyPrefix}-s-${n++}`}>{inner}</del>);
    }
    last = regex.lastIndex;
  }
  if (last < input.length) out.push(input.slice(last));
  return out;
}

export function SlackText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {renderInline(line, `l${idx}`)}
          {idx < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </>
  );
}
