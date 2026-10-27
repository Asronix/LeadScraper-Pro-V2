import { Lead, Tag } from '../types/index.ts';

export const DEFAULT_TAGS: Tag[] = [
  {
    id: 'tag_founder',
    name: 'Founder / C-Level',
    color: '#059669',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-300 dark:border-emerald-800'
  },
  {
    id: 'tag_vc',
    name: 'Investor / VC',
    color: '#7c3aed',
    bgColor: 'bg-purple-100 dark:bg-purple-950/50',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-300 dark:border-purple-800'
  },
  {
    id: 'tag_marketing',
    name: 'Marketing / Growth',
    color: '#2563eb',
    bgColor: 'bg-blue-100 dark:bg-blue-950/50',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-800'
  },
  {
    id: 'tag_urgent',
    name: 'High Priority',
    color: '#e11d48',
    bgColor: 'bg-rose-100 dark:bg-rose-950/50',
    textColor: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-300 dark:border-rose-800'
  },
  {
    id: 'tag_press',
    name: 'Press & Media',
    color: '#d97706',
    bgColor: 'bg-amber-100 dark:bg-amber-950/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-800'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead_1',
    email: 'sarah.jenkins@hyperflow.io',
    websiteName: 'HyperFlow AI',
    domain: 'hyperflow.io',
    url: 'https://hyperflow.io/about',
    pageTitle: 'HyperFlow AI | Next-gen Automation Platform',
    discoveredAt: '2026-10-14T09:15:00.000Z',
    status: 'outreached',
    outreachedAt: '2026-10-14T14:30:00.000Z',
    tags: ['tag_founder', 'tag_urgent'],
    notes: 'Reached out regarding enterprise tier partnership. Follow up on Q4 pilot.',
    followUpDate: '2026-10-16',
    followUpNote: 'Check in if pilot deck was shared with CTO',
    confidenceScore: 98,
    history: [
      { timestamp: '2026-10-14T09:15:00.000Z', action: 'Discovered via Chrome Extension on https://hyperflow.io/about' },
      { timestamp: '2026-10-14T14:30:00.000Z', action: 'Status changed to Outreached by user' }
    ]
  },
  {
    id: 'lead_2',
    email: 'marcus.vance@sequoia-style-ventures.com',
    websiteName: 'Sequoia Style Ventures',
    domain: 'sequoia-style-ventures.com',
    url: 'https://sequoia-style-ventures.com/team',
    pageTitle: 'Our Investment Partners & Team',
    discoveredAt: '2026-10-13T16:20:00.000Z',
    status: 'uncontacted',
    tags: ['tag_vc', 'tag_urgent'],
    notes: 'Partner leading early-stage developer infrastructure investments.',
    followUpDate: '2026-10-15',
    followUpNote: 'Send intro email with 1-page pitch memo',
    confidenceScore: 95,
    history: [
      { timestamp: '2026-10-13T16:20:00.000Z', action: 'Discovered via Chrome Extension on https://sequoia-style-ventures.com/team' }
    ]
  },
  {
    id: 'lead_3',
    email: 'elena.rostova@techchronicle.net',
    websiteName: 'Tech Chronicle',
    domain: 'techchronicle.net',
    url: 'https://techchronicle.net/editorial-staff',
    pageTitle: 'Editorial Staff & Tech Columnists',
    discoveredAt: '2026-10-12T11:05:00.000Z',
    status: 'outreached',
    outreachedAt: '2026-10-12T17:40:00.000Z',
    tags: ['tag_press'],
    notes: 'Senior tech reporter covering AI browser extensions and productivity tools.',
    followUpDate: '2026-10-14', // Due today
    followUpNote: 'Follow up on embargo press release feedback',
    confidenceScore: 92,
    history: [
      { timestamp: '2026-10-12T11:05:00.000Z', action: 'Discovered via Chrome Extension' },
      { timestamp: '2026-10-12T17:40:00.000Z', action: 'Status changed to Outreached' }
    ]
  },
  {
    id: 'lead_4',
    email: 'david.chen@cloudscale-saas.co',
    websiteName: 'CloudScale Systems',
    domain: 'cloudscale-saas.co',
    url: 'https://cloudscale-saas.co/contact-us',
    pageTitle: 'CloudScale | Enterprise Multi-cloud Architecture',
    discoveredAt: '2026-10-11T13:45:00.000Z',
    status: 'uncontacted',
    tags: ['tag_marketing'],
    notes: 'VP of Growth & Partnerships. Discovered in footer contact block.',
    confidenceScore: 94,
    history: [
      { timestamp: '2026-10-11T13:45:00.000Z', action: 'Discovered via Chrome Extension' }
    ]
  },
  {
    id: 'lead_5',
    email: 'claire.morrison@venturepulse.org',
    websiteName: 'VenturePulse Media',
    domain: 'venturepulse.org',
    url: 'https://venturepulse.org/contact',
    pageTitle: 'Contact the VenturePulse Team',
    discoveredAt: '2026-10-09T08:30:00.000Z',
    status: 'outreached',
    outreachedAt: '2026-10-09T10:15:00.000Z',
    tags: ['tag_founder', 'tag_marketing'],
    notes: 'Podcast host and newsletter curator. Asked for a demo recording.',
    followUpDate: '2026-10-10', // Overdue
    followUpNote: 'Send updated product demo video link',
    confidenceScore: 97,
    history: [
      { timestamp: '2026-10-09T08:30:00.000Z', action: 'Discovered via Chrome Extension' },
      { timestamp: '2026-10-09T10:15:00.000Z', action: 'Status marked as Outreached' }
    ]
  }
];

export interface PresetWebsite {
  id: string;
  name: string;
  domain: string;
  url: string;
  category: string;
  description: string;
  html: string;
}

export const PRESET_WEBSITES: PresetWebsite[] = [
  {
    id: 'preset_startup',
    name: 'SaaSify Cloud Technologies',
    domain: 'saasify-cloud.io',
    url: 'https://saasify-cloud.io/company/team',
    category: 'Startup Directory',
    description: 'Realistic SaaS startup team page with visible executive emails and partner outbound links.',
    html: `
<div class="saas-site">
  <div class="site-header">
    <div class="site-logo">⚡ SaaSify Cloud</div>
    <div class="site-nav">
      <a href="https://saasify-cloud.io/products" class="nav-inlink">Products</a> • 
      <a href="https://saasify-cloud.io/solutions" class="nav-inlink">Solutions</a> • 
      <a href="https://saasify-cloud.io/company/team" class="nav-inlink">Team</a> • 
      <a href="/pricing" class="nav-inlink">Pricing</a>
    </div>
  </div>
  
  <div class="hero-section">
    <h1>Meet the Team Building the Future of Work</h1>
    <p>We are a distributed team across San Francisco, London, and Tokyo. Reach out directly to our leadership or explore our external publications.</p>
  </div>

  <div class="team-grid">
    <div class="team-card">
      <div class="avatar">👨‍💼</div>
      <h3>Alex Rivera</h3>
      <p class="role">Co-Founder & CEO</p>
      <p class="bio">Previously VP Product at Datadog. Featured on <a href="https://techcrunch.com/2026/01/saasify-cloud-series-a" target="_blank" class="ext-link">TechCrunch Series A Coverage</a>.</p>
      <div class="contact-line">
        Direct Email: <a href="mailto:alex.rivera@saasify-cloud.io" class="email-link">alex.rivera@saasify-cloud.io</a>
      </div>
    </div>

    <div class="team-card">
      <div class="avatar">👩‍💻</div>
      <h3>Maya Lin</h3>
      <p class="role">Chief Technology Officer</p>
      <p class="bio">Distributed systems architect. Maintainer of the <a href="https://github.com/saasify-cloud/crm-sync" target="_blank" class="ext-link">GitHub Open Source Sync Engine</a>.</p>
      <div class="contact-line">
        Direct Email: <span class="email-text">maya.lin@saasify-cloud.io</span>
      </div>
    </div>

    <div class="team-card">
      <div class="avatar">💼</div>
      <h3>Jordan Blake</h3>
      <p class="role">Head of Global Partnerships</p>
      <p class="bio">Managing affiliate channels and integrations on the <a href="https://stripe.com/partners/saasify" target="_blank" class="ext-link">Stripe Partner Directory</a>.</p>
      <div class="contact-line">
        Partnerships: <a href="mailto:partnerships@saasify-cloud.io" class="email-link">partnerships@saasify-cloud.io</a>
      </div>
    </div>
  </div>

  <div class="press-mentions" style="margin-top: 18px; padding: 14px; background: rgba(56, 189, 248, 0.08); border-radius: 8px;">
    <h4 style="margin: 0 0 6px 0; font-size: 13px;">Featured Research & Media Mentions:</h4>
    <p style="font-size: 12px; margin: 4px 0;">
      • Verified company profile on <a href="https://crunchbase.com/organization/saasify-cloud" target="_blank" class="ext-link">Crunchbase Database</a><br/>
      • Industry reference report in <a href="https://forbes.com/sites/saas-automation-index" target="_blank" class="ext-link">Forbes Automation Index</a><br/>
      • Real-time updates on <a href="https://x.com/saasify_cloud" target="_blank" class="ext-link">Twitter / X Community</a> (Social)<br/>
      • Connect with team on <a href="https://linkedin.com/company/saasify-cloud" target="_blank" class="ext-link">LinkedIn Business Hub</a> (Social)
    </p>
  </div>

  <div class="footer-section">
    <p>General inquiries: info@saasify-cloud.io | Press desk: press@saasify-cloud.io</p>
    <p>© 2026 SaaSify Cloud Technologies Inc. All rights reserved. <a href="https://saasify-cloud.io/privacy" class="nav-inlink">Privacy Policy</a></p>
  </div>
</div>
`
  },
  {
    id: 'preset_honeypot',
    name: 'Honeypot Trap & Hidden Elements Testbed',
    domain: 'security-testbed.dev',
    url: 'https://security-testbed.dev/honeypot-test',
    category: 'Security & Filter Testbed',
    description: 'Contains visible team emails AND hidden spam-traps (display:none, type="hidden", aria-hidden="true"). Perfect for testing hidden bypass!',
    html: `
<div class="testbed-site">
  <div class="site-header">
    <div class="site-logo">🛡️ Security Verification Testbed</div>
    <div class="site-badge">Active Honeypot & Anti-Scraper Traps Enabled</div>
  </div>

  <div class="notice-box">
    <strong>Test Scenario:</strong> This webpage has legitimate visible contacts, but also contains 3 hidden honeypot spam-traps designed to trip naive scrapers. 
    Notice how LeadScrape Pro extracts ONLY the visible contacts and bypasses the hidden traps!
  </div>

  <div class="content-box">
    <h2>Visible Human Contacts</h2>
    <p>Our founder is reachable at: <span class="highlight-target">founder@security-testbed.dev</span></p>
    <p>Customer help desk: <a href="mailto:support@security-testbed.dev">support@security-testbed.dev</a></p>
    <p>Sales manager: <span class="highlight-target">sales.director@security-testbed.dev</span></p>
  </div>

  <div style="margin-top: 14px; font-size: 12px;">
    <h4>Official Research References:</h4>
    <p>
      • Mitre Vulnerability Notice: <a href="https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2026-8910" target="_blank">CVE-2026-8910 Security Bulletin</a><br/>
      • Threat Intelligence Analysis by <a href="https://krebsonsecurity.com/2026/02/anti-honeypot-standards" target="_blank">KrebsOnSecurity Whitepaper</a><br/>
      • Recommended Standards: <a href="https://owasp.org/www-project-top-ten" target="_blank">OWASP Anti-Bot Defense Guide</a><br/>
      • Official Discord Group: <a href="https://reddit.com/r/netsec" target="_blank">NetSec Community Discussions</a>
    </p>
  </div>

  <!-- HIDDEN HONEYPOT TRAP 1: display: none -->
  <div style="display: none;" class="anti-bot-trap-1">
    <p>Do not scrape this bot trap: honeypot-trap1@security-testbed.dev</p>
  </div>

  <!-- HIDDEN HONEYPOT TRAP 2: input type="hidden" -->
  <form style="margin-top: 10px;">
    <input type="hidden" name="stealth_honeypot" value="decoy-hidden-input@security-testbed.dev" />
    <input type="text" placeholder="Your name..." style="padding: 6px; border: 1px solid #ccc; border-radius: 4px;" />
  </form>

  <!-- HIDDEN HONEYPOT TRAP 3: visibility: hidden and aria-hidden="true" -->
  <div style="visibility: hidden;" aria-hidden="true">
    <span>accessibility-hidden-spamtrap@security-testbed.dev</span>
  </div>

  <div class="footer-box" style="margin-top: 20px; font-size: 13px; color: #64748b;">
    <p>Official Media Contact (Visible): <a href="mailto:media@security-testbed.dev">media@security-testbed.dev</a></p>
    <p>Internal link check: <a href="https://security-testbed.dev/legal">Legal Policies</a></p>
  </div>
</div>
`
  },
  {
    id: 'preset_vc',
    name: 'Apex Horizon Capital',
    domain: 'apexhorizon.vc',
    url: 'https://apexhorizon.vc/portfolio-team',
    category: 'Venture Capital',
    description: 'Venture capital partners and investment associates contact portal with portfolio outbound links.',
    html: `
<div class="vc-site">
  <div class="site-header">
    <div class="site-logo">🏛️ APEX HORIZON CAPITAL</div>
    <div class="site-nav">
      <a href="https://apexhorizon.vc/portfolio" class="vc-inlink">Portfolio</a> • 
      <a href="https://apexhorizon.vc/thesis" class="vc-inlink">Thesis</a> • 
      <a href="https://apexhorizon.vc/team" class="vc-inlink">Team</a>
    </div>
  </div>

  <div class="hero">
    <h1>Backing Transformative Founders at Seed & Series A</h1>
    <p>We invest $1M - $10M in AI infrastructure, developer tooling, and intelligent CRM pipelines.</p>
  </div>

  <div class="partners-list">
    <div class="partner-row">
      <strong>Victoria Sterling</strong> - Managing General Partner
      <p>Invests in enterprise software. Quoted in <a href="https://bloomberg.com/news/articles/2026-03-apex-horizon" target="_blank">Bloomberg Venture Review</a>. Direct: <a href="mailto:victoria@apexhorizon.vc">victoria@apexhorizon.vc</a></p>
    </div>
    <div class="partner-row">
      <strong>Dr. Liam Thorne</strong> - AI & Research Partner
      <p>Author of AI Market Synthesis published on <a href="https://pitchbook.com/profiles/investor/apex-horizon" target="_blank">PitchBook Benchmarks</a>. Pitch desk: <a href="mailto:liam.thorne@apexhorizon.vc">liam.thorne@apexhorizon.vc</a></p>
    </div>
    <div class="partner-row">
      <strong>Investment Submissions</strong>
      <p>Submit pitch decks and one-pagers directly to: <span class="email-block">deals@apexhorizon.vc</span></p>
      <p>Portfolio reference: <a href="https://sequoiacap.com/companies" target="_blank">Syndicate Partner Portfolio</a></p>
    </div>
  </div>

  <div style="margin-top: 20px; font-size: 12px; color: #64748b;">
    <p>External syndicate coverage: <a href="https://wsj.com/articles/venture-capital-ai-seed-2026" target="_blank">Wall Street Journal Venture Report</a></p>
    <p>© 2026 Apex Horizon Capital Management LLC. <a href="https://apexhorizon.vc/disclaimer">Regulatory Disclaimers</a></p>
  </div>
</div>
`
  }
];
