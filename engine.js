// Телефон внутри ролевой: переписка, лента, люди, заказы, снимки.
// Ответы персонажа просит модель клиента. Картинки остаются файлами на устройстве.

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function blankPhone() {
  return { v: 1, contacts: [], threads: {}, posts: [], orders: [], images: [] };
}

function ensurePeople(phone, names) {
  const user = names.user || 'Ты';
  const char = names.char || 'Персонаж';
  if (!phone.contacts.some((c) => c.kind === 'user')) {
    phone.contacts.unshift({ id: 'user', name: user, kind: 'user' });
  } else {
    const u = phone.contacts.find((c) => c.kind === 'user');
    u.name = user;
  }
  if (!phone.contacts.some((c) => c.kind === 'char')) {
    phone.contacts.push({ id: 'char', name: char, kind: 'char' });
  } else {
    const c = phone.contacts.find((x) => x.kind === 'char');
    c.name = char;
    c.id = c.id || 'char';
  }
  return phone;
}

function contact(phone, id) {
  return phone.contacts.find((c) => c.id === id) || null;
}

function thread(phone, id) {
  if (!phone.threads[id]) phone.threads[id] = [];
  return phone.threads[id];
}

function recentLines(phone, limit) {
  const rows = [];
  Object.keys(phone.threads || {}).forEach((id) => {
    const who = contact(phone, id);
    (phone.threads[id] || []).slice(-3).forEach((m) => {
      rows.push({ ts: m.ts, text: (who ? who.name : 'чат') + ': ' + (m.from === 'user' ? 'ты' : who ? who.name : 'они') + ' — ' + m.text });
    });
  });
  (phone.posts || []).slice(0, 2).forEach((p) => {
    const who = contact(phone, p.authorId);
    rows.push({ ts: p.ts, text: 'лента, ' + (who ? who.name : 'кто-то') + ': ' + p.text });
  });
  (phone.orders || []).slice(0, 1).forEach((o) => {
    rows.push({ ts: o.ts, text: 'заказ: ' + o.item + (o.note ? ' (' + o.note + ')' : '') });
  });
  return rows.sort((a, b) => b.ts - a.ts).slice(0, limit || 8).map((r) => r.text);
}

function promptBlock(phone, names) {
  const lines = recentLines(phone, 8);
  if (!lines.length) return '';
  return '[Телефон ' + (names.user || 'человека') + ' и ' + (names.char || 'персонажа') + '. Это уже случилось, не пересказывай меню.]\n' + lines.map((l) => '• ' + l).join('\n');
}

function cleanReply(text) {
  const t = String(text || '').replace(/<think[\s\S]*?<\/think>/gi, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 500) return '';
  if (/(промпт|модель|ассистент|system prompt)/i.test(t)) return '';
  return t.replace(/^["«]|["»]$/g, '');
}

function replyPrompt(phone, contactId, names) {
  const who = contact(phone, contactId);
  const hist = thread(phone, contactId).slice(-10).map((m) => (m.from === 'user' ? (names.user || 'Ты') : (who ? who.name : 'Собеседник')) + ': ' + m.text).join('\n');
  return [
    'Ты пишешь одно короткое сообщение в телефоне от лица: ' + (who ? who.name : 'собеседник') + '.',
    who && who.kind === 'npc' ? 'Это посторонний человек, не главный персонаж чата.' : 'Это переписка, не описание сцены.',
    'Без кавычек, без звёздочек, без пояснений. 1–3 предложения.',
    'Переписка:',
    hist || '(пусто)',
  ].join('\n');
}

function commentPrompt(phone, post, names) {
  return [
    'Короткий комментарий в ленте от лица ' + (names.char || 'персонажа') + '.',
    'Одно-два предложения, разговорный тон, без кавычек и без пояснений.',
    'Пост: ' + post.text,
  ].join('\n');
}

const LocalSocialEngine = {
  uid, blankPhone, ensurePeople, contact, thread, recentLines, promptBlock, cleanReply, replyPrompt, commentPrompt,
};
globalThis.LocalSocialEngine = LocalSocialEngine;
export { LocalSocialEngine };
