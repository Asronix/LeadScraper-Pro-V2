import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEmail,
  isValidEmail,
  extractDomain,
  extractWebsiteName,
  isSnippetHidden,
  parseAndClassifyEmails,
  isDomainExcluded,
  extractOutboundLinksFromHtml,
  formatJerryCollaborationEmail,
  buildGmailComposeUrl
} from './scraper.ts';

test('sanitizeEmail removes unwanted characters and prefixes', () => {
  assert.equal(sanitizeEmail('mailto:contact@acme.com'), 'contact@acme.com');
  assert.equal(sanitizeEmail('MAILTO:founder@acme.com'), 'founder@acme.com');
  assert.equal(sanitizeEmail('mailto:sales@corp.com?subject=Hello%20World'), 'sales@corp.com');
  assert.equal(sanitizeEmail('<mailto:info@startup.io>'), 'info@startup.io');
  assert.equal(sanitizeEmail('contact@acme.com.'), 'contact@acme.com');
  assert.equal(sanitizeEmail('<info@startup.io>'), 'info@startup.io');
  assert.equal(sanitizeEmail('  ceo@company.org,  '), 'ceo@company.org');
});

test('isValidEmail correctly identifies valid and invalid emails', () => {
  assert.equal(isValidEmail('sarah.connor@cyberdyne.systems'), true);
  assert.equal(isValidEmail('sales+leads@shopify.co.uk'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('invalid@'), false);
  assert.equal(isValidEmail('@domain.com'), false);
});

test('extractDomain correctly parses hostnames', () => {
  assert.equal(extractDomain('https://www.stripe.com/pricing'), 'stripe.com');
  assert.equal(extractDomain('http://blog.sub.google.com/post/1'), 'blog.sub.google.com');
  assert.equal(extractDomain('john@airbnb.com'), 'airbnb.com');
  assert.equal(extractDomain('github.com/trending'), 'github.com');
});

test('extractWebsiteName creates clean brand names', () => {
  assert.equal(extractWebsiteName('https://stripe.com/pricing', 'Stripe: Payment Gateway for the Internet'), 'Stripe');
  assert.equal(extractWebsiteName('https://notion.so', 'Notion – Connected workspace'), 'Notion');
  assert.equal(extractWebsiteName('https://linear.app'), 'Linear');
});

test('isSnippetHidden flags display:none, visibility:hidden, and hidden inputs', () => {
  assert.equal(isSnippetHidden('<div style="display:none">spamtrap@honeypot.org</div>').isHidden, true);
  assert.equal(isSnippetHidden('<span style="visibility: hidden">hidden@secret.com</span>').isHidden, true);
  assert.equal(isSnippetHidden('<input type="hidden" value="stealth@trap.io">').isHidden, true);
  assert.equal(isSnippetHidden('<div aria-hidden="true">aria@stealth.com</div>').isHidden, true);
  assert.equal(isSnippetHidden('<p class="font-bold text-gray-800">hello@founder.com</p>').isHidden, false);
});

test('parseAndClassifyEmails correctly separates visible emails from hidden bypasses', () => {
  const html = `
    <html>
      <body>
        <header>
          <h1>Acme Corp</h1>
          <p>Reach our sales team at <a href="mailto:sales@acmeco.com">sales@acmeco.com</a></p>
          <p>Founder desk: alex@acmeco.com.</p>
        </header>
        <div style="display:none" class="bot-trap">
          <input type="hidden" name="trap" value="bot-honeypot@acmeco.com" />
        </div>
      </body>
    </html>
  `;

  const result = parseAndClassifyEmails(html, 'https://acmeco.com/contact', 'Acme Corp | Contact Us');
  assert.equal(result.visibleEmails.includes('sales@acmeco.com'), true);
  assert.equal(result.visibleEmails.includes('alex@acmeco.com'), true);
  assert.equal(result.visibleEmails.includes('bot-honeypot@acmeco.com'), false);
  assert.equal(result.hiddenEmailsBypassed.some(h => h.email === 'bot-honeypot@acmeco.com'), true);
});

test('isDomainExcluded detects blacklist and subdomains', () => {
  const blacklist = ['facebook.com', 'twitter.com', 'google.com'];
  assert.equal(isDomainExcluded('https://facebook.com/page', blacklist), true);
  assert.equal(isDomainExcluded('blog.twitter.com', blacklist), true);
  assert.equal(isDomainExcluded('https://www.google.com/search', blacklist), true);
  assert.equal(isDomainExcluded('https://healthhub.org', blacklist), false);
});

test('extractOutboundLinksFromHtml filters in-links, mailto, javascript, and keeps external links only', () => {
  const html = `
    <div>
      <a href="/about-us">About internal</a>
      <a href="https://mysite.com/contact">Contact internal</a>
      <a href="#section-2">Hash link</a>
      <a href="javascript:void(0)">JS link</a>
      <a href="mailto:info@mysite.com">Mailto link</a>
      <a href="https://external-partner.com/research">Partner Research</a>
      <a href="https://twitter.com/mysite">Twitter Profile</a>
    </div>
  `;

  const links = extractOutboundLinksFromHtml(html, 'https://mysite.com/blog', ['twitter.com']);
  assert.equal(links.length, 2);
  const partner = links.find(l => l.domain === 'external-partner.com');
  assert.ok(partner);
  assert.equal(partner.anchorText, 'Partner Research');
  assert.equal(partner.isExcluded, false);

  const twitter = links.find(l => l.domain === 'twitter.com');
  assert.ok(twitter);
  assert.equal(twitter.isExcluded, true);
});

test('formatJerryCollaborationEmail personalizes Jerry’s guest article template', () => {
  const formatted = formatJerryCollaborationEmail('Health Digest', 'https://healthdigest.com');
  assert.ok(formatted.includes('Health Digest (https://healthdigest.com)'));
  assert.ok(formatted.includes('I’m Jerry from Sustainable Growth Experts'));
  assert.ok(formatted.includes('medical accuracy'));
});

test('buildGmailComposeUrl constructs valid web compose link', () => {
  const url = buildGmailComposeUrl('editor@medsite.org', 'MedSite', 'https://medsite.org');
  assert.ok(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1'));
  assert.ok(url.includes('to=editor%40medsite.org'));
  assert.ok(url.includes('su=Guest%20Article%20%26%20Content%20Collaboration'));
});
