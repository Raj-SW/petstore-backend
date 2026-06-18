# Engagement Panels — Backend & Admin Wiring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining admin gaps for the homepage Engagement section: (A) let admins create the **promo** slides (image + link) shown beside the forms, and (B) let admins **reply** to customer questions from the admin panel (sends an email to the customer).

**Architecture:** (A) is frontend-only — the Advert backend already accepts the `promo` placement; AdminAdverts just never exposed it. (B) adds a new admin reply endpoint on the existing Contact resource that emails the customer via the existing Resend `sendEmail` + a new Handlebars template, plus a reply box in AdminContacts.

**Tech Stack:** Express + Mongoose + Joi + Jest/supertest (backend); React 18 + Vite (frontend). Email via Resend SMTP `sendEmail` + Handlebars. No new npm packages.

**Already done (no work):** Feedback publish-with-images → "What Our Clients Say". `AdminFeedback` has the approve toggle; `StatsSection.jsx` fetches approved feedback via `feedbackApi.getFeedback` and maps `fb.photos[0]` into each testimonial card with a hardcoded fallback. Verified in code.

**⚠️ Repo layout:** `backend/` and `frontend/` are **separate git repos**. Commit backend changes inside `backend/`, frontend inside `frontend/`.

---

## File Structure

| File | Change |
|---|---|
| `frontend/src/Pages/Admin/Adverts/AdminAdverts.jsx` | Add `promo` placement option + treat link/image as optional for it |
| `backend/src/models/contact.model.js` | Add `lastReply` + `repliedAt` fields |
| `backend/src/controllers/contact.controller.js` | Add `replyToContact` |
| `backend/src/routes/contact.routes.js` | Add `POST /:id/reply` (admin) |
| `backend/src/templates/contact-reply.html` | New reply email |
| `backend/tests/contact.reply.test.js` | New focused test |
| `frontend/src/Services/api/contactApi.js` | Add `replyContact` |
| `frontend/src/Pages/Admin/Contacts/AdminContacts.jsx` | Reply box in the view modal |

---

## Phase A — Promo placement in AdminAdverts (frontend-only)

### Task 1: Expose the `promo` placement

**Files:**
- Modify: `frontend/src/Pages/Admin/Adverts/AdminAdverts.jsx`

- [ ] **Step 1: Add the dropdown option**

Replace the placement `<select>` options block (currently banner/sponsored/hero) with one that includes promo:

```jsx
                <select id="aa-placement" value={form.placement} onChange={set("placement")}>
                  <option value="banner">Banner (between sections)</option>
                  <option value="sponsored">Sponsored card (in grid)</option>
                  <option value="hero">Homepage carousel (hero banner)</option>
                  <option value="promo">Homepage engagement promo</option>
                </select>
```

- [ ] **Step 2: Make link optional for promo (validation)**

Replace the `handleSave` validation line:

```jsx
    if (form.title.trim().length < 2 || (form.placement !== "hero" && !form.link.trim())) {
      addToast("Title is required (and a link for banner/sponsored adverts)", "error");
      return;
    }
```

with (link optional for both hero and promo):

```jsx
    const linkOptional = form.placement === "hero" || form.placement === "promo";
    if (form.title.trim().length < 2 || (!linkOptional && !form.link.trim())) {
      addToast("Title is required (and a link for banner/sponsored adverts)", "error");
      return;
    }
```

- [ ] **Step 3: Reflect optional link/image labels + add a promo hint**

Change the Image label line:

```jsx
                <label>Image{form.placement === "hero" ? "" : " (optional)"}</label>
```
to:
```jsx
                <label>Image{form.placement === "hero" || form.placement === "promo" ? "" : " (optional)"}</label>
```

Change the Link label line:

```jsx
                  Link{form.placement === "hero" ? " (optional)" : ""}
```
to:
```jsx
                  Link{form.placement === "hero" || form.placement === "promo" ? " (optional)" : ""}
```

Add a promo hint right after the existing hero hint block (`{form.placement === "hero" && (<p className="aa-hint">…</p>)}`):

```jsx
                {form.placement === "promo" && (
                  <p className="aa-hint">Shown beside the homepage Ask-a-Question / Feedback forms. Recommended ~720 × 900 px (portrait card).</p>
                )}
```

- [ ] **Step 4: Build**

Run (from `frontend/`): `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Pages/Admin/Adverts/AdminAdverts.jsx
git commit -m "feat: expose promo placement (image+link) in AdminAdverts for homepage engagement slides"
```

---

## Phase B — Reply to customer questions

### Task 2: Failing reply API test

**Files:**
- Create: `backend/tests/contact.reply.test.js`

- [ ] **Step 1: Write the failing test**

```js
/**
 * POST /api/contact/:id/reply — admin replies to a customer message (emails them)
 */

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Contact = require('../src/models/contact.model');
const { sendEmail } = require('../src/utils/email');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
  return res.body.data.accessToken;
}

describe('Contact reply', () => {
  let adminToken;
  let customerToken;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });

  beforeEach(async () => {
    await User.deleteMany({});
    await Contact.deleteMany({});
    await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
    sendEmail.mockClear();
  });

  afterAll(async () => { await mongoose.connection.close(); });

  it('sends a reply email and marks the message replied (200)', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Do you board cats?' });
    const res = await request(app)
      .post(`/api/contact/${c._id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Yes, we board cats — happy to help!' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('replied');
    expect(res.body.data.lastReply).toBe('Yes, we board cats — happy to help!');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('jane@example.com');
  });

  it('400 when the reply message is empty', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Hi' });
    const res = await request(app)
      .post(`/api/contact/${c._id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('404 for a missing contact', async () => {
    const res = await request(app)
      .post(`/api/contact/${new mongoose.Types.ObjectId()}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello' });
    expect(res.status).toBe(404);
  });

  it('rejects a non-admin (403) and unauthenticated (401)', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Hi' });
    expect((await request(app).post(`/api/contact/${c._id}/reply`).send({ message: 'x' })).status).toBe(401);
    expect((await request(app).post(`/api/contact/${c._id}/reply`).set('Authorization', `Bearer ${customerToken}`).send({ message: 'x' })).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `backend/`): `npx jest tests/contact.reply.test.js --runInBand`
Expected: FAIL — route returns 404 (no `/reply` route yet).

*(No commit yet — commit lands green in Task 4.)*

---

### Task 3: Contact model fields + reply controller + email template

**Files:**
- Modify: `backend/src/models/contact.model.js`
- Modify: `backend/src/controllers/contact.controller.js`
- Create: `backend/src/templates/contact-reply.html`

- [ ] **Step 1: Add reply fields to the model**

In `backend/src/models/contact.model.js`, add these two fields immediately after the `status` field block (after its closing `},` and before the schema options `{ timestamps: true }`):

```js
    lastReply: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    repliedAt: {
      type: Date,
    },
```

- [ ] **Step 2: Write the reply email template**

Create `backend/src/templates/contact-reply.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reply from VitalPaws</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: #2c7a4b; padding: 28px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .content { padding: 28px 24px; }
    .content p { margin: 0 0 16px; }
    .reply { background: #f0f8f3; border-left: 3px solid #2c7a4b; padding: 14px 16px; border-radius: 6px; white-space: pre-wrap; }
    .original { color: #888; font-size: 13px; border-top: 1px solid #eee; margin-top: 24px; padding-top: 14px; white-space: pre-wrap; }
    .footer { background: #f8f9fa; text-align: center; padding: 20px 24px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 VitalPaws</h1>
    </div>
    <div class="content">
      <p>Hi <strong>{{name}}</strong>,</p>
      <p>Thanks for reaching out — here's our reply:</p>
      <div class="reply">{{message}}</div>
      {{#if original}}
      <div class="original"><strong>Your original message:</strong><br>{{original}}</div>
      {{/if}}
    </div>
    <div class="footer">
      <p>© 2026 VitalPaws &middot; Reply to this email if you need anything else.</p>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: Add the `replyToContact` controller**

In `backend/src/controllers/contact.controller.js`, add this export after `updateContactStatus` (before `deleteContact`):

```js
// POST /api/contact/:id/reply  — admin only
exports.replyToContact = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Invalid contact id', 400));
    }
    const message = (req.body.message || '').trim();
    if (!message) {
      return next(new AppError('Reply message is required', 400));
    }
    const contact = await Contact.findById(req.params.id);
    if (!contact) return next(new AppError('Contact not found', 404));

    // Send the reply — if this throws, status is left unchanged so the admin knows it failed.
    await sendEmail({
      to: contact.email,
      subject: 'Re: your message to VitalPaws',
      template: 'contact-reply',
      data: { name: contact.name, message, original: contact.message },
    });

    contact.status = 'replied';
    contact.lastReply = message;
    contact.repliedAt = new Date();
    await contact.save();

    logger.info('Contact reply sent', { contactId: contact._id });
    return res.status(200).json({ success: true, message: 'Reply sent', data: contact });
  } catch (error) {
    return next(error);
  }
};
```

---

### Task 4: Route wiring → green + commit

**Files:**
- Modify: `backend/src/routes/contact.routes.js`

- [ ] **Step 1: Add the route + import**

In `backend/src/routes/contact.routes.js`, add `replyToContact` to the destructured import and register the route in the admin section:

```js
const {
  submitContact,
  getContacts,
  updateContactStatus,
  deleteContact,
  replyToContact,
} = require('../controllers/contact.controller');
```

Add after the `router.patch('/:id', ...)` line:

```js
router.post('/:id/reply', isAuthenticated, isAdmin, replyToContact);
```

- [ ] **Step 2: Run the reply tests to green**

Run: `npx jest tests/contact.reply.test.js --runInBand`
Expected: PASS — all 4 tests green.

- [ ] **Step 3: Run the existing contact suite (no regressions)**

Run: `npx jest tests/contact.controller.test.js --runInBand`
Expected: PASS.

- [ ] **Step 4: Commit (inside `backend/`)**

```bash
cd backend
git add src/models/contact.model.js src/controllers/contact.controller.js src/routes/contact.routes.js src/templates/contact-reply.html tests/contact.reply.test.js
git commit -m "feat: admin reply to contact messages (emails customer, marks replied)"
```

---

### Task 5: Reply UI in AdminContacts

**Files:**
- Modify: `frontend/src/Services/api/contactApi.js`
- Modify: `frontend/src/Pages/Admin/Contacts/AdminContacts.jsx`

- [ ] **Step 1: Add `replyContact` to contactApi**

In `frontend/src/Services/api/contactApi.js`, add this method (after `updateContact`):

```js
  // Admin: send a reply email to the customer
  replyContact: async (id, message) => {
    const response = await api.post(`/contact/${id}/reply`, { message });
    return response.data;
  },
```

- [ ] **Step 2: Add reply state + handler in AdminContacts**

In `frontend/src/Pages/Admin/Contacts/AdminContacts.jsx`, add state near the other `useState` hooks:

```jsx
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
```

Add a handler after `confirmDelete`:

```jsx
  const sendReply = async () => {
    if (!viewing || !replyText.trim()) return;
    try {
      setSendingReply(true);
      await contactApi.replyContact(viewing._id, replyText.trim());
      addToast("Reply sent", "success");
      setReplyText("");
      setViewing(null);
      fetchContacts();
    } catch {
      addToast("Failed to send reply", "error");
    } finally {
      setSendingReply(false);
    }
  };
```

- [ ] **Step 3: Replace the view-modal actions with a reply box**

Replace the modal actions block:

```jsx
              <div className="admin-modal-actions">
                <a className="at-btn-secondary" href={`mailto:${viewing.email}`}><FiCornerUpLeft size={13} /> Reply by email</a>
                <button className="aa-submit" onClick={() => { cycleStatus(viewing); setViewing(null); }}>
                  Mark {STATUS_CYCLE[viewing.status] || "read"}
                </button>
              </div>
```

with a reply textarea + send button (keep the status button):

```jsx
              {viewing.lastReply && (
                <p className="ac-view-message" style={{ background: "#f0f8f3", borderRadius: 8, padding: "10px 12px" }}>
                  <strong>Last reply:</strong> {viewing.lastReply}
                </p>
              )}
              <textarea
                className="es-input es-textarea"
                style={{ width: "100%", minHeight: 90, marginTop: 8 }}
                placeholder={`Reply to ${viewing.name}…`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="admin-modal-actions">
                <button className="at-btn-secondary" onClick={() => { cycleStatus(viewing); setViewing(null); }}>
                  Mark {STATUS_CYCLE[viewing.status] || "read"}
                </button>
                <button className="aa-submit" disabled={sendingReply || !replyText.trim()} onClick={sendReply}>
                  <FiCornerUpLeft size={13} /> {sendingReply ? "Sending…" : "Send reply"}
                </button>
              </div>
```

- [ ] **Step 4: Reset reply text when the modal closes**

Find where the view modal closes (`onClick={() => setViewing(null)}` on the backdrop) and change it to also clear the draft:

```jsx
onClick={() => { setViewing(null); setReplyText(""); }}
```

- [ ] **Step 5: Build**

Run (from `frontend/`): `npm run build`
Expected: clean build.

- [ ] **Step 6: Commit (inside `frontend/`)**

```bash
cd frontend
git add src/Services/api/contactApi.js src/Pages/Admin/Contacts/AdminContacts.jsx
git commit -m "feat: reply to customer questions from AdminContacts (sends email)"
```

---

## Self-Review

**Spec coverage:**
- Promo: admin sets image + link → Task 1 (dropdown option + optional link/image + hint); backend already supports `promo` ✅
- Feedback: publish with images → "What Our Clients Say" → already implemented (AdminFeedback approve + StatsSection maps `photos[0]`); no task needed ✅
- Question form: admin can reply to client queries → Tasks 2–5 (reply endpoint emails customer + marks replied; AdminContacts reply box) ✅

**Placeholder scan:** none — every code step has complete code. The AdminContacts edits anchor on exact existing lines read from the file.

**Type/name consistency:** `replyToContact` controller (Task 3) ↔ route (Task 4) ↔ `contactApi.replyContact` (Task 5) ↔ test endpoint `/api/contact/:id/reply` (Task 2) all consistent ✅. Contact fields `lastReply`/`repliedAt` consistent across model (Task 3), controller (Task 3), test assertions (Task 2), AdminContacts display (Task 5) ✅. `promo` placement value consistent with backend validator (`Joi.valid('banner','sponsored','hero','promo')`) ✅.
