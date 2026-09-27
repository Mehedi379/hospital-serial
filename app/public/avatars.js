/* Shared doctor avatar helper — used by tv / assistant / admin / launcher pages.
 * Picks a female or male doctor avatar based on the doctor's name (English or
 * Bangla), or shows the doctor's real photo if photoURL is set.
 * Exposes: window.doctorAvatar(name, nameBn, photoURL) -> { img, icon }
 *   img  = HTML string (img tag with real photo, or empty)
 *   icon = HTML string (inline SVG avatar, always present as fallback)
 */
(function () {
  /* -------- name-based gender detection (Bangla + English) -------- */
  const FEMALE_FIRST = [
    // English / romanized
    'farhana', 'nargis', 'sultana', 'chowdhury-f', 'sumona', 'sumaiya', 'rasheda',
    'salma', 'nasrin', 'nusrat', 'sabina', 'shirin', 'rokeya', 'rahima', 'ayesha',
    'aysha', 'fatema', 'fatima', 'mariam', 'marium', 'sadia', 'shahida', 'shefali',
    'momena', 'zannat', 'jannat', 'risty', 'tania', 'taniya', 'tonia', 'munni',
    'priyanka', 'dipa', 'deepa', 'ruma', 'juthi', 'mitu', 'pinky', 'rubi', 'rubi-',
    'shanta', 'sharmin', 'shamima', 'shahana', 'samina', 'sabrina', 'sanjida',
    'sadia-islam', 'tanjin', 'tahmina', 'tahmin', 'ismrat', 'israt', 'esrat',
    'afroza', 'afroja', 'asma', 'asama', 'khalida', 'mahfuza', 'mahmuda', 'marjina',
    // Bangla names (as written on the TV)
    'ফারহানা', 'নার্গিস', 'সুলতানা', 'সুমাইয়া', 'সুমনা', 'রাশেদা', 'সালমা',
    'নাসরিন', 'নুসরাত', 'সাবিনা', 'শিরিন', 'রোকেয়া', 'রহিমা', 'আয়েশা', 'আয়শা',
    'ফাতেমা', 'ফাতিমা', 'মরিয়ম', 'সাদিয়া', 'শাহিদা', 'শেফালি', 'মমতাজ', 'মমতা',
    'জান্নাত', 'রিস্টি', 'তানিয়া', 'তানিয়া', 'মুন্নি', 'প্রিয়াঙ্কা', 'দীপা',
    'রুমা', 'জুঠি', 'মিতু', 'পিঙ্কি', 'রুবি', 'শান্তা', 'শারমিন', 'শামিমা',
    'শাহানা', 'সাবরিনা', 'সাজিদা', 'তাহমিনা', 'ইসরাত', 'আফরোজা', 'খালেদা',
    'মাহফুজা', 'মাহমুদা', 'মার্জিনা', 'রাখি', 'মুনিয়া', 'লাকি', 'লতা',
  ];
  const FEMALE_SUFFIX = ['begum', 'বেগম', 'আক্তার', 'akter', 'akther', 'sultana-'];
  const MALE_FIRST = [
    'oliur', 'tariqul', 'tarikul', 'masud', 'karim', 'rahim', 'abdul', 'md', 'md.',
    'mohammad', 'muhammad', 'shahidul', 'rafiqul', 'jamal', 'kamal', 'mizanur',
    'mahbub', 'habibur', 'saiful', 'nazrul', 'anwar', 'ashraful', 'tanvir',
    'tuhin', 'rumon', 'ripon', 'jahid', 'jahangir', 'helal', 'kamrul',
    'ওলিউর', 'তারিকুল', 'মাসুদ', 'করিম', 'রহিম', 'আব্দুল', 'মোঃ', 'মো',
    'মোহাম্মদ', 'শাহিদুল', 'রফিকুল', 'জামাল', 'কামাল', 'মিজানুর', 'মাহবুব',
    'সাইফুল', 'নজরুল', 'আনোয়ার', 'আশরাফুল', 'তানভীর', 'তুহিন', 'রিপন', 'জাহিদ',
    'জাহাঙ্গীর', 'হেলাল', 'কামরুল',
  ];

  function isFemaleName(name) {
    const n = String(name || '').toLowerCase();
    if (!n) return false;
    if (FEMALE_FIRST.some((f) => n.includes(f))) return true;
    if (FEMALE_SUFFIX.some((f) => n.includes(f))) return true;
    // English honorifics
    if (/\b(mrs|ms|dr\.?\s*mrs)\b/.test(n)) return true;
    // Bangla: "ডা. সুমাইয়া আক্তার" style — check any token match
    const tokens = n.split(/[\s.]+/);
    if (tokens.some((t) => FEMALE_FIRST.includes(t))) return true;
    return false;
  }

  function isMaleName(name) {
    const n = String(name || '').toLowerCase();
    if (!n) return false;
    if (MALE_FIRST.some((m) => n.includes(m))) return true;
    if (/\b(mr)\b/.test(n)) return true;
    return false;
  }

  function detectGender(nameEn, nameBn) {
    if (isFemaleName(nameEn) || isFemaleName(nameBn)) return 'female';
    if (isMaleName(nameEn) || isMaleName(nameBn)) return 'male';
    return 'unknown';
  }

  /* -------- inline SVG avatars (self-contained, no files needed) -------- */
  // Female doctor: hijab-free female doctor with bun, white coat, stethoscope
  const FEMALE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="#f6e2e2"/>
  <g>
    <path d="M20 96c2-18 13-26 28-26s26 8 28 26z" fill="#fff" stroke="#e3dddd" stroke-width="1.5"/>
    <path d="M42 74h12v22H42z" fill="#c22832" opacity=".9"/>
    <path d="M48 74l-8 8 8 14 8-14z" fill="#fff"/>
  </g>
  <g>
    <path d="M30 46c0-12 8-20 18-20s18 8 18 20-8 22-18 22-18-10-18-22z" fill="#f2c9a5"/>
    <path d="M28 44c0-14 9-23 20-23s20 9 20 23c0 5-1 8-2 10 1-16-7-20-18-20s-19 4-18 20c-1-2-2-5-2-10z" fill="#5d3b2e"/>
    <circle cx="26" cy="52" r="6" fill="#5d3b2e"/>
    <circle cx="70" cy="52" r="6" fill="#5d3b2e"/>
    <circle cx="42" cy="48" r="2.2" fill="#33302e"/>
    <circle cx="54" cy="48" r="2.2" fill="#33302e"/>
    <path d="M44 58q4 3 8 0" stroke="#b06b4f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="M35 74c4 6 9 8 13 8s9-2 13-8" fill="none" stroke="#2f7d6d" stroke-width="3" stroke-linecap="round"/>
  <circle cx="61" cy="86" r="4.5" fill="#2f7d6d"/>
  <circle cx="61" cy="86" r="1.8" fill="#fff"/>
</svg>`;

  // Male doctor: male doctor with short hair, white coat, stethoscope
  const MALE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="#e3e7f2"/>
  <g>
    <path d="M20 96c2-18 13-26 28-26s26 8 28 26z" fill="#fff" stroke="#d8dadc" stroke-width="1.5"/>
    <path d="M42 74h12v22H42z" fill="#3a475c" opacity=".9"/>
    <path d="M48 74l-8 8 8 14 8-14z" fill="#fff"/>
  </g>
  <g>
    <path d="M30 46c0-12 8-20 18-20s18 8 18 20-8 22-18 22-18-10-18-22z" fill="#eebd8e"/>
    <path d="M29 44c0-14 8-23 19-23s19 9 19 23l-3 2c1-12-6-16-16-16s-17 4-16 16z" fill="#26211d"/>
    <circle cx="42" cy="48" r="2.2" fill="#2b2622"/>
    <circle cx="54" cy="48" r="2.2" fill="#2b2622"/>
    <path d="M42 44l6-2 6 2" stroke="#26211d" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M44 58q4 3 8 0" stroke="#a5613f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
  <path d="M35 74c4 6 9 8 13 8s9-2 13-8" fill="none" stroke="#2f7d6d" stroke-width="3" stroke-linecap="round"/>
  <circle cx="61" cy="86" r="4.5" fill="#2f7d6d"/>
  <circle cx="61" cy="86" r="1.8" fill="#fff"/>
</svg>`;

  // Unknown-gender: neutral white-coat clinician
  const UNKNOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="#eceef0"/>
  <path d="M20 96c2-18 13-26 28-26s26 8 28 26z" fill="#fff" stroke="#d8dadc" stroke-width="1.5"/>
  <path d="M42 74h12v22H42z" fill="#525f75" opacity=".85"/>
  <path d="M48 74l-8 8 8 14 8-14z" fill="#fff"/>
  <circle cx="48" cy="46" r="20" fill="#cbb6a0"/>
  <path d="M30 44c0-13 8-21 18-21s18 8 18 21l-3 1c1-11-6-15-15-15s-16 4-15 15z" fill="#4a423b"/>
  <circle cx="42" cy="47" r="2.1" fill="#332e29"/>
  <circle cx="54" cy="47" r="2.1" fill="#332e29"/>
  <path d="M44 56q4 3 8 0" stroke="#8a5c40" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M35 74c4 6 9 8 13 8s9-2 13-8" fill="none" stroke="#2f7d6d" stroke-width="3" stroke-linecap="round"/>
  <circle cx="61" cy="86" r="4.5" fill="#2f7d6d"/>
</svg>`;

  function svgToDataUri(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /**
   * Returns avatar pieces for a doctor.
   * @param {string} nameEn    doctor name in English
   * @param {string} nameBn    doctor name in Bangla (optional)
   * @param {string} photoURL  real photo URL if the hospital attached one (optional)
   */
  window.doctorAvatar = function (nameEn, nameBn, photoURL) {
    const gender = detectGender(nameEn, nameBn);
    const svg = gender === 'female' ? FEMALE_SVG : gender === 'male' ? MALE_SVG : UNKNOWN_SVG;
    const img = photoURL
      ? `<img src="${String(photoURL).replace(/"/g, '&quot;')}" alt="${String(nameEn || '').replace(/"/g, '&quot;')}" class="doctor-photo" />`
      : '';
    return { img, icon: img ? '' : svgToDataUri(svg), gender };
  };

  // Also expose the raw detector for admin page hints
  window.detectDoctorGender = detectGender;
})();
