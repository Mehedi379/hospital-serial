/*
 * Bangla <-> English name transliteration (translit.js)
 * Works in Node (module.exports) and browser (window.translit).
 *
 * detectScript(text) -> 'bn' | 'en'
 * toBangla(text)  : "Md. Abdul Karim"  -> "মোঃ আব্দুল করিম"
 * toEnglish(text) : "মোঃ আব্দুল করিম" -> "Md. Abdul Karim"
 *
 * Rule-based (no API), tuned for Bangladeshi person/doctor names.
 * Long vowels, conjuncts and common name spellings get special care.
 */
(function (root) {
  'use strict';

  /* ---------------- script detection ---------------- */
  const BN_RE = /[\u0980-\u09FF]/;
  function detectScript(text) {
    return BN_RE.test(String(text || '')) ? 'bn' : 'en';
  }

  /* ---------------- English -> Bangla ---------------- */
  // Ordered: longer patterns first so they win.
  const EN_BN = [
    ['md.', 'মোঃ'], ['md', 'মোঃ'], ['mst', 'মোসাঃ'], ['mrs', 'মিসেস'], ['mr.', 'মিঃ'],
    ['dr.', 'ডা.'], ['dr', 'ডা.'],
    ['sch', 'স্ক'], ['ssh', 'শ্ব'], ['chh', 'ছ'], ['ch', 'চ'],
    ['kh', 'খ'], ['gh', 'ঘ'], ['th', 'থ'], ['dh', 'ধ'], ['ph', 'ফ'], ['bh', 'ভ'],
    ['sh', 'শ'], ['ng', 'ং'],
    ['aa', 'া'], ['ee', 'ী'], ['oo', 'ু'], ['ou', 'ৌ'],
    ['kha', 'খা'], ['gha', 'ঘা'],
    ['ia', 'িয়া'], ['iya', 'িয়া'], ['io', 'িও'],
    ['ai', 'াই'], ['au', 'ৌ'], ['oi', 'য়'],
    ['a', 'া'], ['i', 'ি'], ['u', 'ু'], ['e', 'ে'], ['o', 'ো'],
    // consonants (single)
    ['k', 'ক'], ['g', 'গ'], ['j', 'জ'], ['t', 'ত'], ['d', 'দ'], ['n', 'ন'],
    ['p', 'প'], ['b', 'ব'], ['m', 'ম'], ['r', 'র'], ['l', 'ল'], ['s', 'স'],
    ['h', 'হ'], ['z', 'জ'], ['f', 'ফ'], ['w', 'ও'], ['x', 'ক্স'], ['q', 'ক'], ['v', 'ভ'], ['c', 'ক'], ['y', 'ই'],
  ];

  // Special-case spellings for very common name words (highest priority)
  const EN_WORDS = {
    'abdul': 'আব্দুল', 'karim': 'করিম', 'rahman': 'রহমান', 'rahim': 'রহিম',
    'islam': 'ইসলাম', 'miah': 'মিয়া', 'mia': 'মিয়া', 'uddin': 'উদ্দিন',
    'rana': 'রানা', 'jahan': 'জাহান', 'akter': 'আক্তার', 'akhter': 'আক্তার',
    'shirina': 'শিরিনা',
    'hossain': 'হোসেন', 'hossein': 'হোসেন', 'hassan': 'হাসান', 'hasan': 'হাসান',
    'chowdhury': 'চৌধুরী', 'choudhury': 'চৌধুরী', 'chowdhary': 'চৌধুরী',
    'ahmed': 'আহমেদ', 'ahmad': 'আহমদ', 'alam': 'আলম', 'ali': 'আলী',
    'farhana': 'ফারহানা', 'nargis': 'নার্গিস', 'sultana': 'সুলতানা',
    'sumaiya': 'সুমাইয়া', 'tariqul': 'তারিকুল', 'tarikul': 'তারিকুল',
    'oliur': 'ওলিউর', 'masud': 'মাসুদ', 'mehedi': 'মেহেদী', 'hasan': 'হাসান',
    'akther': 'আক্তার', 'akter': 'আক্তার', 'begum': 'বেগম', 'khatun': 'খাতুন',
    'mohammad': 'মোহাম্মদ', 'muhammad': 'মুহাম্মদ', 'md': 'মোঃ',
    'shahidul': 'শাহিদুল', 'rafiqul': 'রফিকুল', 'kamrul': 'কামরুল',
    'mizanur': 'মিজানুর', 'habibur': 'হাবিবুর', 'saiful': 'সাইফুল',
    'mahbub': 'মাহবুব', 'tanvir': 'তানভীর', 'jahid': 'জাহিদ', 'helal': 'হেলাল',
    'nasrin': 'নাসরিন', 'nusrat': 'নুসরাত', 'fatema': 'ফাতেমা', 'ayesha': 'আয়েশা',
    'ishrat': 'ইশরাত', 'shirin': 'শিরিন', 'sabina': 'সাবিনা', 'rumana': 'রুমানা',
    'rakib': 'রাকিব', 'sakib': 'সাকিব', 'sabbir': 'সাব্বির', 'tuhin': 'তুহিন',
    'ripon': 'রিপন', 'bulbul': 'বুলবুল', 'sohel': 'সোহেল', 'jamal': 'জামাল',
    'hospital': 'হাসপাতাল',
    'mst': 'মোসাঃ', 'mrs': 'মিসেস', 'bhai': 'ভাই',
  };

  function enToBnWord(word) {
    const low = word.toLowerCase();
    if (EN_WORDS[low]) return EN_WORDS[low];
    // Consonant + i + consonant = ি (NOT িয়): "tania" -> তানিয়া is special-cased;
    // generic rule: "i" between consonants is a simple ি.
    const isName = /^[a-z]+$/i.test(low);
    let out = '';
    let i = 0;
    const w = low;
    // Special: consonant + "ia"/"io" at end (tania -> তানিয়া, Ratio rare) — treat "ia" as িয়া
    while (i < w.length) {
      let matched = false;
      //context: "i" + consonant => ি (short i)
      for (const [en, bn] of EN_BN) {
        if (w.startsWith(en, i)) {
          out += bn;
          i += en.length;
          matched = true;
          break;
        }
      }
      if (!matched) { out += w[i]; i++; }
    }
    // Cleanup: leading vowel should not carry a kar (া etc.)
    out = out.replace(/^([ক-হ](?:্[ক-হ])*)[ািীুেোৌ]/, '$1');
    // Fix: ি + া shouldn't happen (e.g. "ia" handled by ['ia','িয়া'] above)
    return out;
  }

  function toBangla(text) {
    const s = String(text || '').trim();
    if (!s || detectScript(s) === 'bn') return s;
    // Tokenize: honorific with trailing dot merges into one word ("Md." "Mst."),
    // everything else splits on spaces.
    return s
      .split(/(\s+)/)
      .map((tok) => {
        if (/\s/.test(tok)) return tok;
        const clean = tok.replace(/[^a-zA-Z.]/g, '').toLowerCase();
        if (!clean) return tok;
        if (clean === 'md.' || clean === 'dr.') {
          return clean === 'md.' ? 'মোঃ' : 'ডা.';
        }
        if (clean === 'mst.' || clean === 'mst') return 'মোসাঃ';
        if (clean === 'mr.') return 'মিঃ';
        if (clean === 'mrs') return 'মিসেস';
        return enToBnWord(clean);
      })
      .join('');
  }

  /* ---------------- Bangla -> English ---------------- */
  const BN_EN_CONS = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': '',
    'জ্ঞ': 'jn', 'ক্ষ': 'kkh',
  };
  const BN_EN_KAR = { 'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou' };
  const BN_EN_WORDS = {
    'মোঃ': 'Md.', 'মো': 'Md.', 'মোসাঃ': 'Mst.', 'মিঃ': 'Mr.', 'মিসেস': 'Mrs.',
    'ডা': 'Dr.', 'ডা.': 'Dr.',
    'আব্দুল': 'Abdul', 'করিম': 'Karim', 'রহমান': 'Rahman', 'রহিম': 'Rahim',
    'ইসলাম': 'Islam', 'মিয়া': 'Miah', 'উদ্দিন': 'Uddin', 'হোসেন': 'Hossain',
    'হাসান': 'Hassan', 'চৌধুরী': 'Chowdhury', 'আহমেদ': 'Ahmed', 'আহমদ': 'Ahmad',
    'আলম': 'Alam', 'আলী': 'Ali', 'ফারহানা': 'Farhana', 'নার্গিস': 'Nargis',
    'সুলতানা': 'Sultana', 'সুমাইয়া': 'Sumaiya', 'তারিকুল': 'Tariqul',
    'ওলিউর': 'Oliur', 'মাসুদ': 'Masud', 'মেহেদী': 'Mehedi', 'হাসান': 'Hasan',
    'আক্তার': 'Akther', 'বেগম': 'Begum', 'খাতুন': 'Khatun',
    'মোহাম্মদ': 'Mohammad', 'মুহাম্মদ': 'Muhammad', 'শাহিদুল': 'Shahidul',
    'রফিকুল': 'Rafiqul', 'কামরুল': 'Kamrul', 'মিজানুর': 'Mizanur',
    'হাবিবুর': 'Habibur', 'সাইফুল': 'Saiful', 'মাহবুব': 'Mahbub', 'তানভীর': 'Tanvir',
    'জাহিদ': 'Jahid', 'হেলাল': 'Helal', 'নাসরিন': 'Nasrin', 'নুসরাত': 'Nusrat',
    'ফাতেমা': 'Fatema', 'আয়েশা': 'Ayesha', 'ইশরাত': 'Ishrat', 'শিরিন': 'Shirin',
    'সাবিনা': 'Sabina', 'রুমানা': 'Romana', 'রাকিব': 'Rakib', 'সাকিব': 'Sakib',
    'সাব্বির': 'Sabbir', 'তুহিন': 'Tuhin', 'রিপন': 'Ripon', 'বুলবুল': 'Bulbul',
    'সোহেল': 'Sohel', 'জামাল': 'Jamal', 'রোগী': 'Rogi', 'হাসপাতাল': 'Hospital',
  };

  function bnToEnWord(word) {
    if (BN_EN_WORDS[word]) return BN_EN_WORDS[word];
    let out = '';
    let pendingHasanta = false;
    let i = 0;
    while (i < word.length) {
      const ch = word[i];
      const next = word[i + 1];
      if (ch === '্') { pendingHasanta = true; i++; continue; } // conjunct: next consonant joins without inherent vowel
      const cons = BN_EN_CONS[ch];
      if (cons) {
        out += cons;
        if (pendingHasanta) { pendingHasanta = false; /* no inherent vowel after conjunct */ }
        else if (next && BN_EN_KAR[next]) { out += BN_EN_KAR[next]; i++; }
        else if (next === '্') { /* joined with next consonant */ }
        else { out += 'o'; } // inherent vowel: রহিমা → Rohima, নমুনা → Nomuna
        i++;
        continue;
      }
      pendingHasanta = false;
      if (BN_EN_KAR[ch]) { out += BN_EN_KAR[ch]; i++; continue; }
      if (ch === 'আ') { out += 'a'; continue; }
      if (ch === 'ই') { out += 'i'; continue; }
      if (ch === 'ঈ') { out += 'ee'; continue; }
      if (ch === 'উ') { out += 'u'; continue; }
      if (ch === 'ঊ') { out += 'u'; continue; }
      if (ch === 'এ') { out += 'e'; continue; }
      if (ch === 'ঐ') { out += 'oi'; continue; }
      if (ch === 'ও') { out += 'o'; continue; }
      if (ch === 'ঔ') { out += 'ou'; continue; }
      if (/[a-zA-Z0-9.\-]/.test(ch)) { out += ch; i++; continue; }
      i++;
    }
    // Tidy: word-internal joiners can leave stray vowels at word boundaries
    out = out.replace(/joa$/i, 'ja').replace(/oa$/i, 'a');
    // Capitalize first letter
    out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }

  function toEnglish(text) {
    const s = String(text || '').trim();
    if (!s || detectScript(s) === 'en') return s;
    return s
      .split(/(\s+)/)
      .map((tok) => (/\s/.test(tok) ? tok : BN_RE.test(tok) ? bnToEnWord(tok) : tok))
      .join('');
  }

  /* ---------------- exports ---------------- */
  const api = { detectScript, toBangla, toEnglish };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.translit = api;
})(typeof window !== 'undefined' ? window : globalThis);
