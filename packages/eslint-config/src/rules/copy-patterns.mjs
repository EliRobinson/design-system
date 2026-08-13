// The six ways functional UI copy gets padded into marketing, as literal
// phrases. Each group is a message the rule can give, so the list is grouped by
// what is wrong with the phrase rather than alphabetically.
//
// These are deliberately literal. A cleverer matcher would catch more and be
// wrong more often, and this rule only earns its place if a hit is obviously a
// hit — anything a reader has to argue with gets the rule switched off.

/** "almost always", "this rarely happens" — a statistic nobody measured. */
const FREQUENCY = [
  'almost always',
  'almost never',
  'rarely happens',
  'this rarely',
  'happens rarely',
  'usually just',
  'in most cases',
  'most of the time',
  'most users',
  'most people',
  'nine times out of ten',
  'more often than not',
  'typically resolves',
];

/** "on their side", "check your connection" — fault the code cannot verify. */
const BLAME = [
  'on their side',
  'on their end',
  'on our side',
  'on our end',
  'on your side',
  'on your end',
  'at their end',
  'at our end',
  'your fault',
  'our fault',
  'check your connection',
  'check your internet',
  'check your network',
  'your connection may',
  'your internet connection',
];

/** "in a moment", "hang tight" — pacing the copy instead of stating the fact. */
const PACING = [
  'in a moment',
  'in just a moment',
  'a moment or two',
  'in a few moments',
  'in a bit',
  'in a sec',
  'just a sec',
  'just a second',
  'just a moment',
  'one moment',
  'hang tight',
  'sit tight',
  'bear with us',
  'bear with me',
  'hold tight',
  'shortly',
];

/**
 * "don't worry", "we'll sort it out" — reassurance nobody asked for.
 *
 * Reassurance that answers a question the reader is actually asking is fine,
 * and is a fact rather than a mood: "You have not been charged." That form
 * carries none of these phrases, so it passes without an exemption.
 */
const REASSURANCE = [
  "don't worry",
  'do not worry',
  'no need to worry',
  'nothing to worry about',
  'no need to panic',
  'no worries',
  'rest assured',
  'sorry about that',
  'sorry about this',
  "we're sorry",
  'we are sorry',
  'we apologize',
  'we apologise',
  'apologies for',
  'our apologies',
  "we'll sort it out",
  "we'll sort this out",
  "we'll get this sorted",
  "we'll take care of it",
  'everything is fine',
  "everything's fine",
];

/** "if it keeps happening, reply to…" — a support surface's job, not a control's. */
const ESCALATION = [
  'if it keeps happening',
  'if this keeps happening',
  'if the problem persists',
  'if this persists',
  'if it persists',
  'if this continues',
  'if you keep seeing',
  'contact support',
  'contact our support',
  'contact us',
  'reach out to support',
  'reach out to us',
  'get in touch with us',
  'let us know and',
  'reply to this email',
];

/** "Great news!", "You're all set!" — chrome does not celebrate. */
const ENTHUSIASM = [
  'great news',
  'good news',
  'awesome',
  'woohoo',
  'hooray',
  'congrats',
  'congratulations',
  "you're all set",
  'you are all set',
  'nice work',
  'way to go',
  'happy to report',
];

/** Phrase groups, keyed by the rule's messageId for that group. */
export const COPY_PHRASES = {
  frequency: FREQUENCY,
  blame: BLAME,
  pacing: PACING,
  reassurance: REASSURANCE,
  escalation: ESCALATION,
  enthusiasm: ENTHUSIASM,
};

const escape = (phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A phrase boundary, so "congrats" does not fire inside "congratulations".
 * Longest alternative first: at a given position the regex takes the first
 * branch that matches, and "in just a moment" should beat "just a moment".
 */
const boundaried = (phrases) => {
  const ordered = [...phrases].sort((a, b) => b.length - a.length).map(escape);
  return new RegExp(`(?<![\\w'])(?:${ordered.join('|')})(?![\\w'])`, 'gi');
};

const MATCHERS = Object.entries(COPY_PHRASES).map(([messageId, phrases]) => ({
  messageId,
  pattern: boundaried(phrases),
}));

/**
 * JSX hands text over exactly as it was typed — wrapped across lines, indented
 * to the element, and carrying whatever apostrophe the editor inserted. Fold
 * all of that away before matching, so a phrase broken by a line wrap still
 * reads as the phrase it is.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeCopy(text) {
  return text.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Every banned phrase in a piece of copy.
 *
 * @param {string} text raw copy, unnormalized
 * @returns {{ messageId: string, phrase: string }[]}
 */
export function paddingIn(text) {
  const normalized = normalizeCopy(text);
  if (!normalized) return [];

  const matches = [];
  for (const { messageId, pattern } of MATCHERS) {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) {
      matches.push({
        messageId,
        phrase: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // One stretch of text is one problem. "try again in just a moment" carries
  // two phrases from the same group; reporting it twice would read as two
  // separate faults with the sentence.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const found = [];
  let consumed = 0;
  for (const match of matches) {
    if (match.start < consumed) continue;
    consumed = match.end;
    found.push({ messageId: match.messageId, phrase: match.phrase });
  }

  return found;
}

/**
 * Whether copy carries an exclamation mark. Separate from the phrase list
 * because it is a character rather than a phrase, and because it is the single
 * most common way enthusiasm gets into a toast.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasExclamation(text) {
  return text.includes('!');
}
