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
  const mapLink =
    req.coords && req.coords.lat !== undefined && req.coords.lng !== undefined
      ? `https://maps.google.com/?q=${req.coords.lat},${req.coords.lng}`
      : '';
  const body = lines([
    ['Owner', req.ownerName],
    ['Phone', req.phone],
    ['Pet', petSummary(req)],
    ['Reason', humanize(req.reason)],
    ['Location', req.address],
    ['Map', mapLink],
    ['Preferred', preferred(formatDate(req.preferredDate), req.preferredTime)],
    ['Notes', req.additionalNotes],
    ['Photo', req.photo && req.photo.url],
  ]);
  const heading = req.isEmergency
    ? '🚨 EMERGENCY — MOBILE VET REQUEST'
    : '🚐 NEW MOBILE VET REQUEST';
  return [heading, '', ...body, '', `Ref: ${req._id}`].join('\n');
}

const isConfigured = () =>
  Boolean(process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY);

/**
 * Fire-and-forget: resolves false rather than throwing, so a provider outage
 * can never fail the customer's booking.
 */
async function sendWhatsApp(text) {
  if (!isConfigured()) {
    logger.warn('WhatsApp notification skipped — CALLMEBOT_PHONE/CALLMEBOT_APIKEY not set');
    return false;
  }
  const url =
    `${API_URL}?phone=${encodeURIComponent(process.env.CALLMEBOT_PHONE)}` +
    `&apikey=${encodeURIComponent(process.env.CALLMEBOT_APIKEY)}` +
    `&text=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      logger.error('WhatsApp notification failed', { status: res.status });
      return false;
    }
    logger.info('WhatsApp notification sent');
    return true;
  } catch (error) {
    logger.error('WhatsApp notification error', { message: error.message });
    return false;
  }
}

module.exports = {
  sendWhatsApp,
  buildAppointmentMessage,
  buildMobileVetMessage,
  isConfigured,
};
