export type LeadStatus = 'uncontacted' | 'outreached' | 'replied' | 'converted' | 'bounced';

export interface Tag {
  id: string;
  name: string;
  color: string; // e.g. '#3b82f6'
  bgColor: string; // e.g. 'bg-blue-100 dark:bg-blue-950/60'
  textColor: string; // e.g. 'text-blue-700 dark:text-blue-300'
  borderColor: string; // e.g. 'border-blue-300 dark:border-blue-800'
}

export interface LeadHistoryItem {
  timestamp: string;
  action: string;
  details?: string;
}

export interface Lead {
  id: string;
  email: string;
  domain: string;
  websiteName: string;
  url: string;
  pageTitle?: string;
  discoveredAt: string;
  status: LeadStatus;
  outreachedAt?: string;
  tags: string[]; // tag IDs
  notes?: string;
  followUpDate?: string; // YYYY-MM-DD
  followUpNote?: string;
  confidenceScore?: number; // 0-100%
  sequenceStep?: number; // 1 = Step 1 Pitch, 2 = Follow-up #1, etc.
  history?: LeadHistoryItem[];
  isFlagged?: boolean;
}

export interface FilterOptions {
  searchQuery: string;
  domainFilter: string;
  statusFilter: LeadStatus | 'all';
  tagFilter: string | 'all';
  sortBy: 'date-desc' | 'date-asc' | 'email-asc' | 'domain-asc' | 'status';
  reminderFilter: 'all' | 'due' | 'overdue' | 'none';
}

export interface ScrapedEmailItem {
  email: string;
  contextSnippet?: string;
  isVisible: boolean;
  bypassReason?: string;
  foundIn: 'text' | 'mailto' | 'attribute' | 'hidden';
}

export interface ScrapeAnalysisResult {
  websiteName: string;
  url: string;
  pageTitle: string;
  totalFound: number;
  visibleEmails: string[];
  hiddenEmailsBypassed: { email: string; reason: string }[];
  scrapedItems: ScrapedEmailItem[];
  timestamp: string;
}

export interface EncryptedSyncBundle {
  version: string;
  exportedAt: string;
  ciphertext: string;
  salt: string;
  iv: string;
  itemCount: number;
}

export interface OutboundLink {
  url: string;
  domain: string;
  anchorText: string;
  target?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface FollowUpTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  defaultDelayDays?: number;
}

export interface GoogleSheetSyncConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  sheetName: string;
  autoSyncEnabled: boolean;
  lastSyncedAt?: string;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
}

export const JERRY_DEFAULT_FOLLOWUP_TEMPLATE: FollowUpTemplate = {
  id: 'jerry_followup_default',
  name: "Jerry's Gentle Bump Follow-up",
  defaultDelayDays: 4,
  subject: 'Quick follow-up regarding article collaboration with [Site Name and hyperlink to website]',
  body: `Hi,

I wanted to quickly bump my previous note in case it got buried in your inbox. 

We'd love to contribute an original, medically reviewed guest article or contextual mention for [Site Name and hyperlink to website]. We handle all the research, drafting, and editorial revisions to match your team's exact standards.

Let me know if you'd like me to send over 3 customized topic ideas for your review.

Best regards,
Jerry
Sustainable Growth Experts`
};

export const DEFAULT_EXCLUDED_DOMAINS: string[] = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
  'google.com'
];

export const JERRY_GUEST_POST_TEMPLATE: EmailTemplate = {
  id: 'jerry_guest_post_collab',
  name: 'Guest Article & Content Collaboration (Jerry Default)',
  subject: 'Guest Article & Content Collaboration',
  body: `Hi,

I’m Jerry from Sustainable Growth Experts. We’re currently looking to collaborate with reputable health and medical websites through guest articles or relevant contextual mentions in existing content on [Site Name and hyperlink to website].

We can provide:

  - Original, high-quality content written with medical accuracy
  - Content tailored to your audience, tone, and editorial guidelines

If you’re open to collaborations, we’d be happy to review your guidelines and requirements.

Looking forward to hearing from you and exploring a potential collaboration.

Best regards,
Jerry
Sustainable Growth Experts`
};

export const PRESET_EMAIL_TEMPLATES: EmailTemplate[] = [
  JERRY_GUEST_POST_TEMPLATE,
  {
    id: 'contextual_mention',
    name: 'Contextual Link & Resource Mention',
    subject: 'Resource Mention & Collaboration for [Site Name and hyperlink to website]',
    body: `Hi,

I hope this email finds you well.

I was recently reading through your great content on [Site Name and hyperlink to website] and noticed your recent coverage on relevant health and industry topics.

Our team at Sustainable Growth Experts recently compiled an authoritative, medically reviewed reference guide on this topic. Would you be open to reviewing it as a potential reference link or contextual addition?

We’d also be thrilled to share your article with our network or explore a mutual guest piece.

Best regards,
Jerry
Sustainable Growth Experts`
  },
  {
    id: 'editorial_partnership',
    name: 'Editorial Partnership & Expert Contribution',
    subject: 'Editorial Contribution Inquiry: [Site Name and hyperlink to website]',
    body: `Hi editorial team,

My name is Jerry from Sustainable Growth Experts. We regularly contribute high-yield, scientifically backed articles to premier publications.

We would love to pitch 3 tailored topic outlines specifically crafted for the readers of [Site Name and hyperlink to website], strictly following your editorial guidelines with zero commercial fluff.

Could you let me know the best person on your editorial team to review these outlines?

Thank you for your time,
Jerry
Sustainable Growth Experts`
  }
];

export interface SequenceStepTemplate {
  step: number;
  id: string;
  name: string;
  defaultDelayDays: number;
  subject: string;
  body: string;
}

export const DEFAULT_SEQUENCE_STEPS: SequenceStepTemplate[] = [
  {
    step: 1,
    id: 'seq_step_1_pitch',
    name: 'Step 1: Initial Pitch (Article Collaboration)',
    defaultDelayDays: 3,
    subject: 'Guest Article & Content Collaboration',
    body: `Hi,

I’m Jerry from Sustainable Growth Experts. We’re currently looking to collaborate with reputable health and medical websites through guest articles or relevant contextual mentions in existing content on [Site Name and hyperlink to website].

We can provide:

  - Original, high-quality content written with medical accuracy
  - Content tailored to your audience, tone, and editorial guidelines

If you’re open to collaborations, we’d be happy to review your guidelines and requirements.

Looking forward to hearing from you and exploring a potential collaboration.

Best regards,
Jerry
Sustainable Growth Experts`
  },
  {
    step: 2,
    id: 'seq_step_2_followup',
    name: 'Step 2: Follow-up #1 (Gentle Bump)',
    defaultDelayDays: 4,
    subject: 'Quick follow-up regarding article collaboration with [Site Name and hyperlink to website]',
    body: `Hi,

I wanted to quickly bump my previous note in case it got buried in your inbox. 

We'd love to contribute an original, medically reviewed guest article or contextual mention for [Site Name and hyperlink to website]. We handle all the research, drafting, and editorial revisions to match your team's exact standards.

Let me know if you'd like me to send over 3 customized topic ideas for your review.

Best regards,
Jerry
Sustainable Growth Experts`
  },
  {
    step: 3,
    id: 'seq_step_3_value',
    name: 'Step 3: Follow-up #2 (Tailored Topic Outlines)',
    defaultDelayDays: 7,
    subject: '3 tailored article ideas for [Site Name and hyperlink to website]',
    body: `Hi,

Following up on my previous notes regarding [Site Name and hyperlink to website]. To make this as easy as possible for your editorial team, here are 3 timely topic ideas we can draft exclusively for you:

1. Emerging Evidence-Based Approaches in Clinical Nutrition & Wellness
2. Preventive Healthcare Strategies: A Comprehensive Practical Guide
3. Key Metrics in Long-term Patient Outcomes: Analysis & Best Practices

All articles include thorough citations from peer-reviewed literature. If any of these catch your eye, we can prepare a draft right away.

Best regards,
Jerry
Sustainable Growth Experts`
  },
  {
    step: 4,
    id: 'seq_step_4_breakup',
    name: 'Step 4: Final Check-in (Closing the loop)',
    defaultDelayDays: 14,
    subject: 'Closing the loop regarding [Site Name and hyperlink to website]',
    body: `Hi,

I understand you're likely very busy, so I won't follow up again regarding guest article collaborations for [Site Name and hyperlink to website].

If collaborating is something you'd like to revisit in the future, please feel free to reach out anytime.

Wishing you and the team continued success!

Best regards,
Jerry
Sustainable Growth Experts`
  }
];

