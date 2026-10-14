function bootSocial(host) {
  const shell = globalThis.LocalShell;
  const eng = globalThis.LocalSocialEngine;
  const ui = shell.mount({
    id: 'social', glyph: '☎', label: 'Локальный телефон', accent: '#e07a62', bottom: 396, right: 16,
  });
  let phone = null;
  let view = 'home';
  let peer = null;
  let urls = {};

  let galleryGen = 0;

  function idb() {
    const factory = shell.win().indexedDB || indexedDB;
    return new Promise((resolve, reject) => {
      const req = factory.open('local-social', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('images')) req.result.createObjectStore('images', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putImage(row) {
    const db = await idb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(row);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getImage(id) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const rq = db.transaction('images', 'readonly').objectStore('images').get(id);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    });
  }

  async function load() {
    const names = await host.names();
    phone = await host.loadChat('phone');
    if (!phone || !Array.isArray(phone.contacts)) phone = eng.blankPhone();
    eng.ensurePeople(phone, names);
    host.setContext(eng.promptBlock(phone, names));
  }

  async function save() {
    await host.saveChat('phone', {
      v: 1,
      contacts: phone.contacts,
      threads: phone.threads,
      posts: phone.posts,
      orders: phone.orders,
      images: phone.images,
    });
    const names = await host.names();
    host.setContext(eng.promptBlock(phone, names));
  }

  function clock() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function home() {
    ui.setBack(null);
    ui.setTitle(clock() + ' · без сети', 'Телефон');
    const apps = [
      ['letters', 'Письма'],
      ['feed', 'Лента'],
      ['people', 'Люди'],
      ['shots', 'Снимки'],
      ['orders', 'Заказы'],
      ['call', 'Звонок'],
    ];
    ui.body.innerHTML = '<div class="lx-grid">' + apps.map((a) =>
      '<button type="button" class="lx-card" data-act="go" data-view="' + a[0] + '"><strong>' + a[1] + '</strong></button>'
    ).join('') + '</div><p class="lx-muted">Переписка и лента остаются в файле чата. Снимки — в хранилище браузера. Чужие ленты, карты, ролики и генераторы картинок не вызываются.</p>';
  }

  function letters() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('на устройстве', 'Письма');
    const esc = shell.esc;
    const people = phone.contacts.filter((c) => c.kind !== 'user');
    ui.body.innerHTML = '<div class="lx-list">' + people.map((c) => {
      const last = (phone.threads[c.id] || []).slice(-1)[0];
      return '<button type="button" class="lx-card" data-act="peer" data-id="' + esc(c.id) + '" style="text-align:left;width:100%"><strong>' +
        esc(c.name) + '</strong><div class="lx-muted">' + esc(last ? last.text : 'пока пусто') + '</div></button>';
    }).join('') + '</div>';
  }

  function chatView() {
    const who = eng.contact(phone, peer);
    ui.setBack(() => { view = 'letters'; render(); });
    ui.setTitle(who ? who.name : 'Чат', 'Письмо');
    const esc = shell.esc;
    const msgs = eng.thread(phone, peer);
    ui.body.innerHTML = '<div class="lx-list" id="lx-soc-log">' + msgs.slice(-30).map((m) =>
      '<div class="lx-card" style="' + (m.from === 'user' ? 'margin-left:18%' : 'margin-right:18%') + '">' + esc(m.text) + '</div>'
    ).join('') + '</div>' +
      '<label class="lx-field">Сообщение<textarea id="lx-soc-text"></textarea></label>' +
      '<button type="button" class="lx-btn primary" data-act="send">Отправить</button>';
  }

  function feed() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('ваши посты', 'Лента');
    const esc = shell.esc;
    ui.body.innerHTML =
      '<label class="lx-field">Новый пост<textarea id="lx-post"></textarea></label>' +
      '<div class="lx-row"><button type="button" class="lx-btn primary" data-act="post" data-who="user">От себя</button>' +
      '<button type="button" class="lx-btn" data-act="post" data-who="char">От персонажа</button></div>' +
      '<div class="lx-list">' + phone.posts.slice(0, 20).map((p) => {
        const who = eng.contact(phone, p.authorId);
        return '<div class="lx-card"><strong>' + esc(who ? who.name : 'кто-то') + '</strong><div style="white-space:pre-wrap">' + esc(p.text) + '</div>' +
          (p.comments || []).map((c) => '<div class="lx-muted">' + esc((eng.contact(phone, c.authorId) || {}).name || '') + ': ' + esc(c.text) + '</div>').join('') +
          '<button type="button" class="lx-btn" data-act="comment" data-id="' + esc(p.id) + '">Комментарий персонажа</button></div>';
      }).join('') + '</div>';
  }

  function people() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('кроме вас двоих', 'Люди');
    const esc = shell.esc;
    ui.body.innerHTML =
      '<label class="lx-field">Имя<input id="lx-npc" maxlength="40" placeholder="курьер, сестра, сосед"></label>' +
      '<button type="button" class="lx-btn primary" data-act="npc">Добавить</button>' +
      '<div class="lx-list">' + phone.contacts.filter((c) => c.kind === 'npc').map((c) =>
        '<div class="lx-card lx-row"><span class="lx-grow">' + esc(c.name) + '</span>' +
        '<button type="button" class="lx-icon" data-act="drop" data-id="' + esc(c.id) + '">×</button></div>'
      ).join('') + '</div>';
  }

  function shots() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('файлы, не ссылки', 'Снимки');
    ui.body.innerHTML =
      '<label class="lx-btn primary">Выбрать снимок<input id="lx-shot" type="file" accept="image/*" hidden></label>' +
      '<div class="lx-grid" id="lx-gallery"></div>';
    const gallery = ui.body.querySelector('#lx-gallery');
    const gen = ++galleryGen;
    phone.images.slice(0, 24).forEach(async (img) => {
      let row = null;
      try { row = await getImage(img.id); } catch (e) { row = null; }
      if (gen !== galleryGen || !gallery.isConnected || !row || !row.blob) return;
      if (!urls[img.id]) urls[img.id] = URL.createObjectURL(row.blob);
      const card = document.createElement('div');
      card.className = 'lx-card';
      card.innerHTML = '<img alt="" style="width:100%;border-radius:10px;display:block">';
      card.querySelector('img').src = urls[img.id];
      gallery.appendChild(card);
    });
    ui.body.querySelector('#lx-shot').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const id = eng.uid();
      try {
        const blob = await shrink(file);
        await putImage({ id, blob });
        phone.images.unshift({ id, name: file.name.slice(0, 80), ts: Date.now() });
        await save();
        render();
      } catch (err) {
        ui.toast('Снимок не сохранился в браузере');
      }
    });
  }

  function shrink(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const local = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(local);
          resolve(blob || file);
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(local); resolve(file); };
      img.src = local;
    });
  }

  function orders() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('запись в сцену', 'Заказы');
    const esc = shell.esc;
    ui.body.innerHTML =
      '<label class="lx-field">Что<input id="lx-item" maxlength="80" placeholder="два кофе"></label>' +
      '<label class="lx-field">Заметка<textarea id="lx-note"></textarea></label>' +
      '<button type="button" class="lx-btn primary" data-act="order">Записать заказ</button>' +
      '<div class="lx-list">' + phone.orders.slice(0, 15).map((o) =>
        '<div class="lx-card"><strong>' + esc(o.item) + '</strong><div class="lx-muted">' + esc(o.note || '') + '</div></div>'
      ).join('') + '</div>';
  }

  function call() {
    ui.setBack(() => { view = 'home'; render(); });
    ui.setTitle('текстом, без линии', 'Звонок');
    const esc = shell.esc;
    const who = phone.contacts.find((c) => c.kind === 'char');
    const log = (phone.threads.call || []).slice(-8);
    ui.body.innerHTML =
      '<p class="lx-muted">Звонок — это несколько реплик, которые модель клиента пишет в чат телефона. Голосового канала нет.</p>' +
      '<button type="button" class="lx-btn primary" data-act="ring">Позвонить ' + esc(who ? who.name : 'персонажу') + '</button>' +
      '<div class="lx-list">' + log.map((m) => '<div class="lx-card">' + esc(m.text) + '</div>').join('') + '</div>';
  }

  function render() {
    if (!phone) { ui.body.innerHTML = '<div class="lx-empty">Открой чат.</div>'; return; }
    if (view === 'letters') return letters();
    if (view === 'thread') return chatView();
    if (view === 'feed') return feed();
    if (view === 'people') return people();
    if (view === 'shots') return shots();
    if (view === 'orders') return orders();
    if (view === 'call') return call();
    return home();
  }

  async function ask(prompt) {
    const raw = await host.generate(prompt);
    const clean = eng.cleanReply(raw);
    if (!clean) throw new Error('пустой ответ');
    return clean;
  }

  ui.body.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.getAttribute('data-act');
    if (act === 'go') { view = el.getAttribute('data-view'); render(); return; }
    if (act === 'peer') { peer = el.getAttribute('data-id'); view = 'thread'; render(); return; }
    if (act === 'send') {
      const text = ui.body.querySelector('#lx-soc-text').value.trim();
      if (!text) return;
      const box = eng.thread(phone, peer);
      box.push({ id: eng.uid(), from: 'user', text, ts: Date.now() });
      await save();
      ui.toast('Жду ответ…');
      try {
        const names = await host.names();
        const reply = await ask(eng.replyPrompt(phone, peer, names));
        box.push({ id: eng.uid(), from: 'them', text: reply, ts: Date.now() });
        await save();
        ui.toast('');
      } catch (err) {
        ui.toast('Ответ не пришёл: ' + (err && err.message ? err.message : 'ошибка клиента'));
      }
      render();
      return;
    }
    if (act === 'post') {
      const text = ui.body.querySelector('#lx-post').value.trim();
      if (!text) return;
      const who = el.getAttribute('data-who') === 'char' ? 'char' : 'user';
      const author = phone.contacts.find((c) => c.kind === who);
      phone.posts.unshift({ id: eng.uid(), authorId: author ? author.id : who, text, ts: Date.now(), comments: [] });
      await save();
      render();
      return;
    }
    if (act === 'comment') {
      const post = phone.posts.find((p) => p.id === el.getAttribute('data-id'));
      if (!post) return;
      ui.toast('Комментарий…');
      try {
        const names = await host.names();
        const text = await ask(eng.commentPrompt(phone, post, names));
        const author = phone.contacts.find((c) => c.kind === 'char');
        post.comments = post.comments || [];
        post.comments.push({ id: eng.uid(), authorId: author ? author.id : 'char', text, ts: Date.now() });
        await save();
        ui.toast('');
      } catch (err) {
        ui.toast('Комментарий не вышел');
      }
      render();
      return;
    }
    if (act === 'npc') {
      const name = ui.body.querySelector('#lx-npc').value.trim();
      if (!name) return;
      phone.contacts.push({ id: eng.uid(), name: name.slice(0, 40), kind: 'npc' });
      await save();
      render();
      return;
    }
    if (act === 'drop') {
      const id = el.getAttribute('data-id');
      phone.contacts = phone.contacts.filter((c) => c.id !== id);
      delete phone.threads[id];
      await save();
      render();
      return;
    }
    if (act === 'order') {
      const item = ui.body.querySelector('#lx-item').value.trim();
      if (!item) return;
      const note = ui.body.querySelector('#lx-note').value.trim();
      phone.orders.unshift({ id: eng.uid(), item, note, ts: Date.now() });
      await save();
      ui.toast('Заказ попал в следующий ответ');
      render();
      return;
    }
    if (act === 'ring') {
      ui.toast('Гудки…');
      const who = phone.contacts.find((c) => c.kind === 'char');
      const names = await host.names();
      const prompt = [
        'Короткий телефонный разговор, 4 реплики.',
        'Формат строго: строка «' + (names.user || 'Ты') + ': …» и строка «' + (who ? who.name : 'Персонаж') + ': …», по очереди.',
        'Без ремарок. Опирайся на последние события чата.',
        (await host.messages()).slice(-6).map((m) => (m.role === 'user' ? names.user : names.char) + ': ' + String(m.text || '').slice(0, 240)).join('\n'),
      ].join('\n');
      try {
        const raw = await host.generate(prompt);
        const lines = eng.callLines(raw);
        phone.threads.call = phone.threads.call || [];
        lines.forEach((text) => phone.threads.call.push({ id: eng.uid(), from: 'call', text: text.slice(0, 300), ts: Date.now() }));
        await save();
        ui.toast('');
      } catch (err) {
        ui.toast('Звонок не сложился');
      }
      render();
    }
  });

  host.on('chat', async () => { await load(); if (!ui.body.closest('section').hidden) render(); });
  const open = async () => { await load(); view = 'home'; ui.open(); render(); };
  host.addMenu('Локальный телефон', open);
  shell.listen(shell.win(), 'open-social', 'local-social-open', open);
  load();
  return { open, close: () => ui.close() };
}

const LocalSocialApp = { boot: bootSocial };
globalThis.LocalSocialApp = LocalSocialApp;
export { LocalSocialApp };
