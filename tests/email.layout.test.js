/**
 * Epic 10 — email template unification.
 * One branded `_layout.html` shell wraps body-only content fragments via
 * renderTemplate; consistent palette; conditional unsubscribe footer; a
 * dedicated verification template (Security F5); no broken template references.
 */
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../src/utils/email');

const TEMPLATES_DIR = path.join(__dirname, '../src/templates');

describe('Email layout unification (Epic 10)', () => {
  it('wraps a content fragment in the branded layout shell', () => {
    const html = renderTemplate('welcome', { name: 'Jane', shopUrl: 'https://x/petshop' });
    // Layout chrome
    expect(html).toMatch(/VitalPaws/);
    expect(html).toMatch(/©|&copy;/);
    expect(html).toMatch(new RegExp(String(new Date().getFullYear())));
    // Fragment content
    expect(html).toMatch(/Jane/);
  });

  it('uses the premium forest/gold palette (not the old green)', () => {
    const html = renderTemplate('welcome', { name: 'Jane', shopUrl: 'https://x/petshop' });
    expect(html).toMatch(/#001C10/i); // forest
    expect(html).toMatch(/#D99A2B/i); // gold
    expect(html).not.toMatch(/#2c7a4b/i); // old welcome green is gone
  });

  it('shows the unsubscribe footer only when unsubscribeUrl is provided', () => {
    const without = renderTemplate('welcome', { name: 'Jane' });
    expect(without.toLowerCase()).not.toContain('unsubscribe');

    const withUnsub = renderTemplate('welcome', { name: 'Jane', unsubscribeUrl: 'https://x/unsub?t=1' });
    expect(withUnsub.toLowerCase()).toContain('unsubscribe');
    expect(withUnsub).toContain('https://x/unsub?t=1');
  });

  it('renders a dedicated verification template using verificationUrl (F5)', () => {
    const html = renderTemplate('email-verification', {
      name: 'Sam', verificationUrl: 'https://x/verify-email/abc',
    });
    expect(html).toContain('https://x/verify-email/abc');
    expect(html.toLowerCase()).toMatch(/verif/);
  });

  it('active content fragments are body-only (no <html>/<head>/<style>)', () => {
    const html = renderTemplate('order-confirmation', { orderId: 'INV-1', name: 'A' });
    // The single <html>/<head> belongs to the layout, not duplicated by the fragment.
    expect((html.match(/<html/gi) || []).length).toBeLessThanOrEqual(1);
    expect((html.match(/<\/head>/gi) || []).length).toBeLessThanOrEqual(1);
  });

  it('every template referenced by sendEmail resolves to a file (no broken refs)', () => {
    const scanDirs = ['src/controllers', 'src/services'].map((d) => path.join(__dirname, '..', d));
    const referenced = new Set();
    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.js')) continue;
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        const re = /template:\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = re.exec(src)) !== null) referenced.add(m[1]);
      }
    }
    expect(referenced.size).toBeGreaterThan(0);
    for (const name of referenced) {
      const file = path.join(TEMPLATES_DIR, `${name}.html`);
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('the orphaned appointment-status.html template is removed', () => {
    expect(fs.existsSync(path.join(TEMPLATES_DIR, 'appointment-status.html'))).toBe(false);
  });
});
