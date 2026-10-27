/**
 * Generates PNG/SVG icons for the Chrome Extension
 */

// Modern gradient SVG icon with target & email radar
export const EXTENSION_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="50%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.3" />
    </filter>
  </defs>
  
  <!-- Outer Rounded Container -->
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bgGrad)" filter="url(#shadow)" />
  
  <!-- Outer Target Ring -->
  <circle cx="64" cy="64" r="42" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4" stroke-dasharray="6 4" />
  
  <!-- Inner Radar Glow -->
  <circle cx="64" cy="64" r="30" fill="none" stroke="url(#glowGrad)" stroke-width="5" />
  
  <!-- Mail Envelope Body -->
  <rect x="40" y="46" width="48" height="36" rx="6" fill="#ffffff" />
  
  <!-- Envelope Flap -->
  <path d="M40 48 L64 67 L88 48" fill="none" stroke="#0284c7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- Lead Finder Target Pin -->
  <circle cx="86" cy="42" r="8" fill="#10b981" stroke="#ffffff" stroke-width="2.5" />
</svg>`;

/**
 * Creates a base64 encoded PNG data URL using an offscreen canvas in browser
 */
export function generateIconPngBase64(size: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw background gradient rounded rectangle
  const radius = size * 0.22;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0284c7');
  gradient.addColorStop(0.5, '#4f46e5');
  gradient.addColorStop(1, '#059669');

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Radar target rings
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();

  // Draw center email icon
  const mailW = size * 0.44;
  const mailH = size * 0.32;
  const mailX = (size - mailW) / 2;
  const mailY = (size - mailH) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const mailR = Math.max(1, size * 0.05);
  ctx.roundRect(mailX, mailY, mailW, mailH, mailR);
  ctx.fill();

  // Mail fold line
  ctx.beginPath();
  ctx.moveTo(mailX, mailY);
  ctx.lineTo(size / 2, mailY + mailH * 0.58);
  ctx.lineTo(mailX + mailW, mailY);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();

  // Emerald target beacon in corner
  ctx.beginPath();
  ctx.arc(mailX + mailW * 0.9, mailY * 0.85, size * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.stroke();

  return canvas.toDataURL('image/png').split(',')[1]; // Return raw base64
}
