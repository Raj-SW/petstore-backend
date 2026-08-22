/**
 * WhatsApp notifications to the clinic's admin number.
 *
 * Provider: CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
 * The admin phone opts in once by messaging the CallMeBot number, which returns
 * an API key; that key + the admin phone go in the env vars below.
 *
 *   CALLMEBOT_PHONE   e.g. 23057580480   (digits only, no + or spaces)
 *   CALLMEBOT_APIKEY  the key CallMeBot replied with
 *
 * Provider isolation: every outbound message goes through `sendWhatsApp`, so
 * swapping to the Meta Cloud API or Twilio later is a change to this file only.
 *
 * PRIVACY NOTE: CallMeBot is a free third-party relay — message contents
 * (owner name, phone, address, pet details) pass through their servers. That
 * trade-off was accepted deliberately; revisit if the clinic needs a data
 * processing agreement.
 */
const logger = require('./logger');

const API_URL = 'https://api.callmebot.com/whatsapp.php';
const TIMEOUT_MS = 8000;
const NL = String.fromCharCode(10);
const RETRIES = 1;
// Overridable so tests do not sit through the real back-off.
const RETRY_DELAY_MS = Number(process.env.WHATSAPP_RETRY_DELAY_MS ?? 65000);

const PET_LABELS = { dog: 'Dog', cat: 'Cat', bird: 'Bird', rabbit: 'Rabbit', other: 'Other' };

// Turn an enum-ish stored value ("home_visit") into something readable.
const humanize = (v) =>
  String(v || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const petLabel = (type) => PET_LABELS[type] || humanize(type);

// Drop lines whose value is missing so the message never shows "undefined".
const lines = (entries) =>
  entries.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([label, v]) => (label ? `${label}: ${v}` : String(v)));

// Long free-text notes are the main thing that blows the message up.
const truncate = (v, max) => {
  const t = String(v || '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const formatDate = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

// "Bella (Dog, Golden Retriever, 3 years, 15 kg)"
const petSummary = ({ petName, petType, breed, age, weight }) => {
  const detail = [petLabel(petType), breed, age, weight].filter(Boolean).join(', ');
  return detail ? `${petName} (${detail})` : petName;
};

const preferred = (day, time) => [day, time].filter(Boolean).join(', ');

function buildAppointmentMessage(req) {
  const body = lines([
    ['Owner', req.ownerName],
    ['Phone', req.phone],
    ['Pet', petSummary(req)],
    ['Reason', humanize(req.reason)],
    ['Preferred', preferred(req.preferredDay, req.preferredTime)],
  ]);
  return ['🐾 NEW APPOINTMENT REQUEST', '', ...body, '', `Ref: ${req._id}`].join('\n');
}

function buildMobileVetMessage(req) {
  // Kept short on purpose. CallMeBot's free endpoint rejects longer requests
  // with an opaque Apache 403 — a compact alert delivers reliably, and the
  // full record (photo, map pin, notes, breed/age/weight) is in the admin
  // panel. The alert only has to get someone to open it.
  const heading = req.isEmergency
    ? '🚨 EMERGENCY mobile vet request'
    : '🚐 New mobile vet request';
  const body = lines([
    [null, [req.ownerName, req.phone].filter(Boolean).join('  ')],
    [null, [req.petName, petLabel(req.petType), humanize(req.reason)].filter(Boolean).join('  ')],
    [null, truncate(req.address, 60)],
    [null, preferred(formatDate(req.preferredDate), req.preferredTime)],
  ]);
  return [heading, ...body, `Ref: ${String(req._id).slice(-8)}`].join(NL);
}

const isConfigured = () =>
  Boolean(process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY);

/**
 * Fire-and-forget: resolves false rather than throwing, so a provider outage
 * can never fail the customer's booking.
 */
const attempt = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.ok) return { ok: true };
  // Capture the body: a bare status made a live failure impossible to diagnose.
  let body = '';
  try {
    body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    body = '(unreadable)';
  }
  return { ok: false, status: res.status, body };
};

async function sendWhatsApp(text) {
  if (!isConfigured()) {
    logger.warn('WhatsApp notification skipped — CALLMEBOT_PHONE/CALLMEBOT_APIKEY not set');
    return false;
  }
  const url =
    `${API_URL}?phone=${encodeURIComponent(process.env.CALLMEBOT_PHONE)}` +
    `&apikey=${encodeURIComponent(process.env.CALLMEBOT_APIKEY)}` +
    `&text=${encodeURIComponent(text)}`;

  for (let i = 0; i <= RETRIES; i += 1) {
    try {
      const r = await attempt(url);
      if (r.ok) {
        logger.info('WhatsApp notification sent', i > 0 ? { attempt: i + 1 } : {});
        return true;
      }
      logger.error('WhatsApp notification failed', {
        status: r.status, body: r.body, attempt: i + 1,
      });
      // CallMeBot answers a burst with an Apache 403; a pause usually clears it.
      if (i < RETRIES) await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    } catch (error) {
      logger.error('WhatsApp notification error', { message: error.message, attempt: i + 1 });
      if (i < RETRIES) await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    }
  }
  return false;
}

module.exports = {
  sendWhatsApp,
  buildAppointmentMessage,
  buildMobileVetMessage,
  isConfigured,
};
