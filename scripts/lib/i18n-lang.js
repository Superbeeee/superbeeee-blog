'use strict';

// 共用的語言設定 helper。
// 舊 scripts 各自帶了一份 copy 且行為已出現分歧（code review #10），
// 新程式碼一律改用這份，舊檔案日後再逐步收攏過來。

function getDefaultLang(config) {
  const lang = config.language;
  if (Array.isArray(lang)) return lang[0];
  if (typeof lang === 'string') return lang.split(',')[0].trim();
  return 'en';
}

function getLanguages(config) {
  const lang = config.language;
  const raw = Array.isArray(lang)
    ? lang
    : (typeof lang === 'string' ? lang.split(',') : []);
  const seen = new Set();
  const result = [];
  raw.forEach((item) => {
    const normalized = String(item || '').trim();
    if (!normalized || normalized === 'default' || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result.length ? result : [getDefaultLang(config)];
}

// 舊翻譯目錄用過 jp，統一正規化成 ja
function normalizeLang(lang) {
  return lang === 'jp' ? 'ja' : lang;
}

module.exports = { getDefaultLang, getLanguages, normalizeLang };
