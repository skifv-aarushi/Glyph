export interface ArchitectureSticker {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  defaultColor: string;
  svg: string;
}

export const ARCHITECTURE_STICKERS: ArchitectureSticker[] = [
  {
    id: 'database-drum',
    name: 'Database Drum',
    description: 'Relational SQL / NoSQL Storage Cluster',
    width: 90,
    height: 100,
    defaultColor: '#00F0FF',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 100" width="90" height="100">
      <defs>
        <linearGradient id="db-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#BD00FF" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <!-- Base Cylinder -->
      <path d="M10 30 V75 C10 88 80 88 80 75 V30" fill="url(#db-grad)" stroke="#00F0FF" stroke-width="3" stroke-linejoin="round"/>
      <!-- Mid-tier line 1 -->
      <path d="M10 46 C10 58 80 58 80 46" fill="none" stroke="#00F0FF" stroke-width="2.5" stroke-dasharray="4 2"/>
      <!-- Mid-tier line 2 -->
      <path d="M10 62 C10 74 80 74 80 62" fill="none" stroke="#00F0FF" stroke-width="2.5" stroke-dasharray="4 2"/>
      <!-- Top Cap -->
      <ellipse cx="45" cy="28" rx="35" ry="14" fill="#121721" stroke="#00F0FF" stroke-width="3"/>
      <ellipse cx="45" cy="28" rx="22" ry="8" fill="none" stroke="#39FF14" stroke-width="1.5" opacity="0.6"/>
      <!-- LED indicators -->
      <circle cx="24" cy="40" r="2.5" fill="#39FF14"/>
      <circle cx="24" cy="56" r="2.5" fill="#39FF14"/>
      <circle cx="24" cy="72" r="2.5" fill="#39FF14"/>
      <text x="45" y="96" font-family="monospace" font-size="9" font-weight="bold" fill="#00F0FF" text-anchor="middle">DATABASE</text>
    </svg>`,
  },
  {
    id: 'server-rack',
    name: 'Server Rack',
    description: 'Compute Node / Microservice Host',
    width: 90,
    height: 100,
    defaultColor: '#39FF14',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 100" width="90" height="100">
      <defs>
        <linearGradient id="srv-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#121721"/>
          <stop offset="100%" stop-color="#0B0E14"/>
        </linearGradient>
      </defs>
      <!-- Outer Chassis -->
      <rect x="12" y="10" width="66" height="76" rx="6" fill="url(#srv-grad)" stroke="#39FF14" stroke-width="3"/>
      <!-- Blade 1 -->
      <rect x="18" y="16" width="54" height="18" rx="3" fill="#1A2130" stroke="#39FF14" stroke-width="1.5"/>
      <circle cx="25" cy="25" r="2" fill="#39FF14"/>
      <circle cx="32" cy="25" r="2" fill="#00F0FF"/>
      <line x1="42" y1="25" x2="65" y2="25" stroke="#6E7681" stroke-width="2" stroke-linecap="round"/>
      <!-- Blade 2 -->
      <rect x="18" y="39" width="54" height="18" rx="3" fill="#1A2130" stroke="#39FF14" stroke-width="1.5"/>
      <circle cx="25" cy="48" r="2" fill="#39FF14"/>
      <circle cx="32" cy="48" r="2" fill="#FCE205"/>
      <line x1="42" y1="48" x2="65" y2="48" stroke="#6E7681" stroke-width="2" stroke-linecap="round"/>
      <!-- Blade 3 -->
      <rect x="18" y="62" width="54" height="18" rx="3" fill="#1A2130" stroke="#39FF14" stroke-width="1.5"/>
      <circle cx="25" cy="71" r="2" fill="#39FF14"/>
      <circle cx="32" cy="71" r="2" fill="#39FF14"/>
      <line x1="42" y1="71" x2="65" y2="71" stroke="#6E7681" stroke-width="2" stroke-linecap="round"/>
      <text x="45" y="96" font-family="monospace" font-size="9" font-weight="bold" fill="#39FF14" text-anchor="middle">SERVER</text>
    </svg>`,
  },
  {
    id: 'cloud-network',
    name: 'Cloud Node',
    description: 'VPC / Cloud Gateway / Edge Worker',
    width: 105,
    height: 90,
    defaultColor: '#00F0FF',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 90" width="105" height="90">
      <defs>
        <linearGradient id="cloud-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#BD00FF" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <!-- Cloud Outline -->
      <path d="M28 62 C16 62 10 52 14 40 C17 31 27 28 32 30 C36 18 52 14 64 22 C70 14 84 16 88 27 C96 28 100 37 96 46 C94 54 87 62 76 62 Z"
            fill="url(#cloud-grad)" stroke="#00F0FF" stroke-width="3" stroke-linejoin="round"/>
      <!-- Internal Network Links -->
      <circle cx="38" cy="46" r="3" fill="#00F0FF"/>
      <circle cx="53" cy="36" r="3.5" fill="#39FF14"/>
      <circle cx="68" cy="48" r="3" fill="#FCE205"/>
      <line x1="38" y1="46" x2="53" y2="36" stroke="#00F0FF" stroke-width="1.5" stroke-dasharray="2 2"/>
      <line x1="53" y1="36" x2="68" y2="48" stroke="#39FF14" stroke-width="1.5" stroke-dasharray="2 2"/>
      <text x="53" y="78" font-family="monospace" font-size="9" font-weight="bold" fill="#00F0FF" text-anchor="middle">CLOUD VPC</text>
    </svg>`,
  },
  {
    id: 'security-shield',
    name: 'Lock / Shield',
    description: 'OAuth 2.0 / JWT / Firewall Barrier',
    width: 90,
    height: 100,
    defaultColor: '#FF003C',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 100" width="90" height="100">
      <defs>
        <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF003C" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#FCE205" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <!-- Shield Perimeter -->
      <path d="M45 12 L75 22 V50 C75 70 45 84 45 84 C45 84 15 70 15 50 V22 Z"
            fill="url(#shield-grad)" stroke="#FF003C" stroke-width="3" stroke-linejoin="round"/>
      <!-- Inner Padlock -->
      <rect x="34" y="44" width="22" height="18" rx="3" fill="#121721" stroke="#FF003C" stroke-width="2"/>
      <!-- Lock Shackle -->
      <path d="M38 44 V36 C38 31 52 31 52 36 V44" fill="none" stroke="#FF003C" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Keyhole -->
      <circle cx="45" cy="51" r="2" fill="#FCE205"/>
      <line x1="45" y1="53" x2="45" y2="58" stroke="#FCE205" stroke-width="2"/>
      <text x="45" y="96" font-family="monospace" font-size="9" font-weight="bold" fill="#FF003C" text-anchor="middle">AUTH LOCK</text>
    </svg>`,
  },
  {
    id: 'client-user',
    name: 'User / Client',
    description: 'Browser Client / End-User Terminal',
    width: 90,
    height: 100,
    defaultColor: '#FCE205',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 100" width="90" height="100">
      <defs>
        <linearGradient id="user-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FCE205" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#FF003C" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <!-- Client Device Outline -->
      <rect x="14" y="16" width="62" height="42" rx="4" fill="url(#user-grad)" stroke="#FCE205" stroke-width="2.5"/>
      <!-- Screen Header dots -->
      <circle cx="21" cy="22" r="1.5" fill="#FF003C"/>
      <circle cx="26" cy="22" r="1.5" fill="#FCE205"/>
      <circle cx="31" cy="22" r="1.5" fill="#39FF14"/>
      <!-- User Avatar Inside Screen -->
      <circle cx="45" cy="34" r="6" fill="none" stroke="#FCE205" stroke-width="2"/>
      <path d="M33 49 C33 43 57 43 57 49" fill="none" stroke="#FCE205" stroke-width="2"/>
      <!-- Device Stand -->
      <path d="M41 58 L39 68 H51 L49 58 Z" fill="#121721" stroke="#FCE205" stroke-width="2"/>
      <line x1="30" y1="68" x2="60" y2="68" stroke="#FCE205" stroke-width="2.5" stroke-linecap="round"/>
      <text x="45" y="86" font-family="monospace" font-size="9" font-weight="bold" fill="#FCE205" text-anchor="middle">CLIENT</text>
    </svg>`,
  },
];

