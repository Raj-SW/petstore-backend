/**
 * Machine translation with a persistent cache.
 *
 * Every distinct string is sent to the provider once, ever — the free tiers
 * are day-limited on characters, so translating per visitor would exhaust
 * them immediately. Results live in the Translation collection.
 *
 * Providers:
 *   MyMemory (default) — no signup, no key. ~5k chars/day anonymous.
 *   DeepL              — set DEEPL_API_KEY. Far better French, 500k chars/month.
 *
 * A human can correct any row and set `reviewed: true`; the cache never
 * overwrites a reviewed translation.
 */
const crypto = require('crypto');
const logger = require('./logger');

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const TIMEOUT_MS = 10000;
// MyMemory rejects long q values; keep batches comfortably under.
const MAX_BATCH_CHARS = 450;

const hashText = (text) =>
  crypto.createHash('sha1').update(String(text)).digest('hex');

/** Group texts so each batch stays under the provider's character budget. */
const chunkTexts = (texts, maxChars = MAX_BATCH_CHARS) => {
  const batches = [];
  let current = [];
  let size = 0;
  for (const t of texts) {
    const len = String(t).length;
    // A single oversized string still goes out on its own rather than being
    // dropped — the provider may truncate, but we never lose it silently.
    if (current.length > 0 && size + len > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
};

const buildMyMemoryUrl = (text, from, to) =>
  `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${from}|${to}`)}`;

/** MyMemory reports quota problems inside the translated text, not the status. */
const parseMyMemory = (payload) => {
  const t = payload && payload.responseData && payload.responseData.translatedText;
  if (!t || typeof t !== 'string') return null;
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) return null;
  return t;
};

const isDeepL = () => Boolean(process.env.DEEPL_API_KEY);

async function translateOneMyMemory(text, from, to) {
  const res = await fetch(buildMyMemoryUrl(text, from, to), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return parseMyMemory(await res.json());
}

async function translateBatchDeepL(texts, from, to) {
  const body = new URLSearchParams();
  texts.forEach((t) => body.append('text', t));
  body.append('source_lang', from.toUpperCase());
  body.append('target_lang', to.toUpperCase());
  const res = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    logger.error('DeepL translation failed', { status: res.status });
    return null;
  }
  const data = await res.json();
  return Array.isArray(data.translations) ? data.translations.map((t) => t.text) : null;
}

/**
 * Translate an array of strings, using the cache where possible.
 * Always resolves to an array the same length as `texts`; any string that
 * could not be translated comes back as the original, never blank.
 */
async function translateTexts(TranslationModel, texts, { from = 'en', to = 'fr' } = {}) {
  const unique = [...new Set(texts.filter((t) => typeof t === 'string' && t.trim()))];
  if (unique.length === 0) return texts.map((t) => t);

  const hashes = unique.map(hashText);
  const cached = await TranslationModel.find({ hash: { $in: hashes }, target: to }).lean();
  const byHash = new Map(cached.map((c) => [c.hash, c.text]));

  const missing = unique.filter((t) => !byHash.has(hashText(t)));

  if (missing.length > 0) {
    if (isDeepL()) {
      for (const batch of chunkTexts(missing, 4000)) {
        const out = await translateBatchDeepL(batch, from, to);
        if (!out) break;
        batch.forEach((src, i) => { if (out[i]) byHash.set(hashText(src), out[i]); });
      }
    } else {
      // MyMemory translates one string per call.
      for (const src of missing) {
        const out = await translateOneMyMemory(src, from, to);
        if (!out) break; // quota hit — stop hammering, serve what we have
        byHash.set(hashText(src), out);
      }
    }

    const fresh = missing
      .filter((src) => byHash.has(hashText(src)))
      .map((src) => ({
        updateOne: {
          filter: { hash: hashText(src), target: to },
          update: {
            $setOnInsert: {
              hash: hashText(src),
              source: src,
              target: to,
              text: byHash.get(hashText(src)),
              provider: isDeepL() ? 'deepl' : 'mymemory',
            },
          },
          upsert: true,
        },
      }));
    if (fresh.length > 0) {
      try {
        await TranslationModel.bulkWrite(fresh, { ordered: false });
      } catch (error) {
        logger.error('Translation cache write failed', { message: error.message });
      }
    }
  }

  // Untranslated strings fall back to the original rather than an empty slot.
  return texts.map((t) => (typeof t === 'string' ? byHash.get(hashText(t)) || t : t));
}

module.exports = {
  translateTexts,
  chunkTexts,
  hashText,
  buildMyMemoryUrl,
  parseMyMemory,
};
