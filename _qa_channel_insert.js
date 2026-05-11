// ===== 질문채널 (거래소와 유사 레이아웃 · 로컬 저장) =====
const QA_STORAGE_KEY = 'ddingty_qa_posts_v1';
const QA_CAT_META = {
  general: { label: '일반', badge: '일반', cls: 'qa-general' },
  game: { label: '게임', badge: '게임', cls: 'qa-game' },
  calc: { label: '계산기', badge: '계산기', cls: 'qa-calc' },
  marine: { label: '해양', badge: '해양', cls: 'qa-marine' }
};
let qaCategoryFilter = 'all';
let qaSortOrder = 'new';
let selectedQaPostId = null;
let qaComposePendingAttachments = [];
let qaReplyPendingAttachments = [];

function normalizeQaPost(p) {
  if (!p || typeof p !== 'object') {
    const now = Date.now();
    return {
      id: `${now}_${Math.random().toString(36).slice(2, 10)}`,
      category: 'general',
      title: '제목 없음',
      authorName: '알 수 없음',
      avatarUrl: '',
      authorInitial: '?',
      body: '',
      ts: now,
      updatedAt: now,
      userId: null,
      authorGuestKey: null,
      reactions: normalizeReactionMap(null),
      reactionsByUser: {},
      attachments: [],
      comments: []
    };
  }
  const category = QA_CAT_META[p.category] ? p.category : 'general';
  const body = typeof p.body === 'string' ? p.body : '';
  let title = typeof p.title === 'string' ? p.title.trim() : '';
  if (!title) {
    const line = body.trim().split(/\r?\n/)[0] || '';
    title = line ? (line.length > 80 ? `${line.slice(0, 80)}…` : line) : '제목 없음';
  }
  const authorName =
    typeof p.authorName === 'string' && p.authorName.trim() ? p.authorName.trim() : '알 수 없음';
  const authorInitial =
    typeof p.authorInitial === 'string' && p.authorInitial
      ? p.authorInitial.charAt(0).toUpperCase()
      : authorName.charAt(0).toUpperCase() || '?';
  let userId = p.userId;
  if (userId !== null && userId !== undefined && typeof userId !== 'string') userId = String(userId);
  if (userId === '') userId = null;
  let authorGuestKey = p.authorGuestKey;
  if (authorGuestKey !== null && authorGuestKey !== undefined && typeof authorGuestKey !== 'string') {
    authorGuestKey = String(authorGuestKey);
  }
  if (authorGuestKey === '') authorGuestKey = null;
  let attachments = [];
  if (Array.isArray(p.attachments)) {
    attachments = p.attachments
      .map(normalizeTradeAttachment)
      .filter(Boolean)
      .slice(0, TRADE_MAX_IMAGES_PER_POST);
  }
  let comments = [];
  if (Array.isArray(p.comments)) {
    comments = p.comments.map(normalizeTradeComment);
  }
  const reactionsByUser = normalizeReactionsByUser(p.reactionsByUser);
  const reactions = deriveReactionCountsFromPost({
    reactionsByUser,
    reactions: p.reactions
  });
  const ts = typeof p.ts === 'number' && Number.isFinite(p.ts) ? p.ts : Date.now();
  const updatedAt =
    typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) ? p.updatedAt : ts;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    category,
    title,
    authorName,
    avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : '',
    authorInitial,
    body,
    ts,
    updatedAt,
    userId,
    authorGuestKey,
    reactions,
    reactionsByUser,
    attachments,
    comments
  };
}

function loadQaPostsFromStorage() {
  try {
    const raw = localStorage.getItem(QA_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(normalizeQaPost) : [];
  } catch (_) {
    return [];
  }
}

function saveQaPosts(posts) {
  try {
    localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(posts.map(normalizeQaPost)));
  } catch (e) {
    console.warn('[질문채널] 저장 실패:', e);
  }
}

function loadQaPosts() {
  return loadQaPostsFromStorage();
}

function setQaCategoryFilter(cat) {
  qaCategoryFilter = cat || 'all';
  document.querySelectorAll('[data-qa-cat]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-qa-cat') === qaCategoryFilter);
  });
  renderQaMessages();
}

function setQaSort(order) {
  qaSortOrder = order === 'old' ? 'old' : 'new';
  const sel = document.getElementById('qaSortSelect');
  if (sel && sel.value !== qaSortOrder) sel.value = qaSortOrder;
  renderQaMessages();
  if (selectedQaPostId) renderQaThreadPanel();
}

function canModifyQaPost(post) {
  if (!post) return false;
  if (isTradeBoardAdmin()) return true;
  const gid = getOrCreateTradeGuestId();
  if (currentAuthUserId && post.userId && String(post.userId) === String(currentAuthUserId)) return true;
  if (!post.userId && post.authorGuestKey && post.authorGuestKey === gid) return true;
  return false;
}

function applySavedProfileToQaPosts(userId) {
  if (!userId || !cachedAuthUserForProfile) return;
  const prof = loadStoredUserProfile(userId);
  const { name, avatarUrl } = extractDiscordProfile(cachedAuthUserForProfile);
  const displayName = prof.displayName && prof.displayName.trim() ? prof.displayName.trim() : name;
  const authorName = displayName || '사용자';
  const initial = (authorName.charAt(0) || '?').toUpperCase();
  const av = avatarUrl || '';
  const posts = loadQaPosts();
  let changed = false;
  const next = posts.map((p) => {
    let np = { ...p };
    if (np.userId && String(np.userId) === String(userId)) {
      np.authorName = authorName;
      np.avatarUrl = av;
      np.authorInitial = initial;
      changed = true;
    }
    if (np.comments && np.comments.length) {
      np.comments = np.comments.map((c) => {
        if (c.userId && String(c.userId) === String(userId)) {
          changed = true;
          return normalizeTradeComment({
            ...c,
            authorName,
            avatarUrl: av,
            authorInitial: initial
          });
        }
        return c;
      });
    }
    return normalizeQaPost(np);
  });
  if (changed) {
    saveQaPosts(next);
    renderQaMessages();
    if (selectedQaPostId) renderQaThreadPanel();
  }
}

function qaComposeAttachClick() {
  const inp = document.getElementById('qaComposeFileInput');
  if (inp) inp.click();
}

async function onQaComposeFilesSelected(ev) {
  const input = ev.target;
  const files = input && input.files;
  if (!files || !files.length) return;
  let room = TRADE_MAX_IMAGES_PER_POST - qaComposePendingAttachments.length;
  for (let i = 0; i < files.length && room > 0; i++) {
    const f = files[i];
    if (!f.type.startsWith('image/')) continue;
    try {
      const dataUrl = await tradeCompressImageToDataUrl(f);
      qaComposePendingAttachments.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'image',
        name: f.name || 'image.jpg',
        dataUrl
      });
      room--;
    } catch (err) {
      console.warn('[질문채널] 이미지 처리 실패:', err);
    }
  }
  input.value = '';
  renderQaComposeAttachPreview();
}

function renderQaComposeAttachPreview() {
  const el = document.getElementById('qaComposeAttachPreview');
  if (!el) return;
  el.innerHTML = qaComposePendingAttachments
    .map(
      (a) =>
        `<div class="trade-attach-chip"><img src="${escapeHtmlTrade(a.dataUrl)}" alt=""><button type="button" aria-label="첨부 제거" onclick="qaRemoveComposeAttachmentById('${escapeHtmlTrade(a.id)}')">×</button></div>`
    )
    .join('');
}

function qaRemoveComposeAttachmentById(id) {
  qaComposePendingAttachments = qaComposePendingAttachments.filter((x) => x.id !== id);
  renderQaComposeAttachPreview();
}

function qaReplyAttachClick() {
  const inp = document.getElementById('qaReplyFileInput');
  if (inp) inp.click();
}

async function onQaReplyFilesSelected(ev) {
  const input = ev.target;
  const files = input && input.files;
  if (!files || !files.length) return;
  let room = TRADE_MAX_IMAGES_PER_POST - qaReplyPendingAttachments.length;
  for (let i = 0; i < files.length && room > 0; i++) {
    const f = files[i];
    if (!f.type.startsWith('image/')) continue;
    try {
      const dataUrl = await tradeCompressImageToDataUrl(f);
      qaReplyPendingAttachments.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'image',
        name: f.name || 'image.jpg',
        dataUrl
      });
      room--;
    } catch (err) {
      console.warn('[질문채널] 이미지 처리 실패:', err);
    }
  }
  input.value = '';
  renderQaReplyAttachPreview();
}

function renderQaReplyAttachPreview() {
  const el = document.getElementById('qaReplyAttachPreview');
  if (!el) return;
  el.innerHTML = qaReplyPendingAttachments
    .map(
      (a) =>
        `<div class="trade-attach-chip"><img src="${escapeHtmlTrade(a.dataUrl)}" alt=""><button type="button" aria-label="첨부 제거" onclick="qaRemoveReplyAttachmentById('${escapeHtmlTrade(a.id)}')">×</button></div>`
    )
    .join('');
}

function qaRemoveReplyAttachmentById(id) {
  qaReplyPendingAttachments = qaReplyPendingAttachments.filter((x) => x.id !== id);
  renderQaReplyAttachPreview();
}

function qaComposeEmojiClick(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (isCurrentTradeActivityBlocked()) {
    alert(tradeRestrictionMessage());
    return;
  }
  openTradeEmojiPopover(ev && ev.currentTarget, 'insert', { textareaId: 'qaPostBody' });
}

function qaReplyEmojiClick(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (isCurrentTradeActivityBlocked()) {
    alert(tradeRestrictionMessage());
    return;
  }
  openTradeEmojiPopover(ev.currentTarget, 'insert', { textareaId: 'qaReplyBody' });
}

function renderQaMessages() {
  const list = document.getElementById('qaMessageList');
  if (!list) return;
  let posts = loadQaPosts().slice();
  posts.sort((x, y) => {
    const ax = x.ts || 0;
    const ay = y.ts || 0;
    return qaSortOrder === 'old' ? ax - ay : ay - ax;
  });
  if (qaCategoryFilter !== 'all') {
    posts = posts.filter((p) => p.category === qaCategoryFilter);
  }
  if (!posts.length) {
    list.innerHTML =
      '<div class="trade-empty">아직 질문이 없습니다. 위에서 제목과 내용을 입력해 첫 질문을 올려 보세요.</div>';
    return;
  }
  list.innerHTML = posts
    .map((p) => {
      const meta = QA_CAT_META[p.category] || QA_CAT_META.general;
      const initial = escapeHtmlTrade((p.authorInitial || (p.authorName || '?').charAt(0)).toUpperCase());
      const avatarInner = p.avatarUrl
        ? `<img src="${escapeHtmlTrade(p.avatarUrl)}" alt="">`
        : `<span>${initial}</span>`;
      const rawBody = (p.body || '').trim();
      const previewText = rawBody.length > 220 ? `${rawBody.slice(0, 220)}…` : rawBody;
      const previewHtml = escapeHtmlTrade(previewText).replace(/\n/g, '<br>');
      const rmap = deriveReactionCountsFromPost(p);
      const thumbs = rmap.thumb || 0;
      const reactTotal = tradeTotalReactionCountFromPost(p);
      const pid = escapeHtmlTrade(p.id);
      const comCount = Array.isArray(p.comments) ? p.comments.length : 0;
      const firstImg =
        p.attachments && p.attachments[0] && p.attachments[0].dataUrl
          ? escapeHtmlTrade(p.attachments[0].dataUrl)
          : '';
      const thumbBlock = firstImg
        ? `<div class="trade-forum-card-thumb"><img src="${firstImg}" alt=""></div>`
        : '';
      const gid = getOrCreateTradeGuestId();
      const isSelf =
        (p.userId && currentAuthUserId && String(p.userId) === String(currentAuthUserId)) ||
        (!p.userId && p.authorGuestKey && p.authorGuestKey === gid);
      const authorTag = isSelf ? '<span class="trade-author-tag" title="현재 기기에서 내 계정으로 작성">작성자</span>' : '';
      return `<article class="trade-forum-card" data-qa-post-id="${pid}">
        <div class="trade-forum-card-inner">
          <h3 class="trade-forum-card-title">${escapeHtmlTrade(p.title || '제목 없음')}</h3>
          <div class="trade-forum-author-line">
            <button type="button" class="trade-forum-avatar-btn" data-qa-profile="${pid}" aria-label="프로필 보기">${avatarInner}</button>
            <span class="trade-forum-author-name">${escapeHtmlTrade(p.authorName || '알 수 없음')}</span>
            ${authorTag}
            <span class="trade-badge ${meta.cls}">${escapeHtmlTrade(meta.badge)}</span>
            <span class="trade-forum-rel">${escapeHtmlTrade(formatRelativeTradeTime(p.ts))}</span>
          </div>
          <div class="trade-forum-preview">${previewHtml}</div>
          <div class="trade-forum-footer">
            <button type="button" class="trade-reaction-btn" data-qa-react="${pid}" data-react-key="thumb" aria-label="좋아요">👍 ${thumbs}</button>
            <span class="trade-forum-stat-muted">✨ 반응 ${reactTotal}</span>
            <span class="trade-forum-stat-muted">💬 답변 ${comCount}</span>
          </div>
        </div>
        ${thumbBlock}
      </article>`;
    })
    .join('');

  list.onclick = function qaListClickDelegate(e) {
    const av = e.target.closest('.trade-forum-avatar-btn[data-qa-profile]');
    if (av) {
      e.stopPropagation();
      openTradeProfileModal(av.getAttribute('data-qa-profile'));
      return;
    }
    const rx = e.target.closest('.trade-reaction-btn[data-qa-react]');
    if (rx) {
      e.preventDefault();
      e.stopPropagation();
      qaOpenReactionEmoji(rx, rx.getAttribute('data-qa-react'));
      return;
    }
    const card = e.target.closest('.trade-forum-card[data-qa-post-id]');
    if (card) {
      openQaThreadPanel(card.getAttribute('data-qa-post-id'));
    }
  };

  if (selectedQaPostId) {
    document.querySelectorAll('.trade-forum-card[data-qa-post-id]').forEach((c) => {
      c.classList.toggle('trade-card-active', c.getAttribute('data-qa-post-id') === selectedQaPostId);
    });
  }
  updateTradeRestrictionUI();
}

function submitQaPost() {
  if (isCurrentTradeActivityBlocked()) {
    alert(tradeRestrictionMessage());
    return;
  }
  const titleIn = document.getElementById('qaPostTitle');
  const ta = document.getElementById('qaPostBody');
  const sel = document.getElementById('qaPostCategory');
  const body = ta ? ta.value.trim() : '';
  const attachSnap = qaComposePendingAttachments.map(normalizeTradeAttachment).filter(Boolean);
  if (!body && !attachSnap.length) {
    alert('질문 내용을 입력하거나 이미지를 첨부해 주세요.');
    return;
  }
  let title = titleIn && titleIn.value.trim() ? titleIn.value.trim() : '';
  if (!title) {
    const line = body.split(/\r?\n/)[0] || '';
    title = line ? (line.length > 80 ? `${line.slice(0, 80)}…` : line) : attachSnap.length ? '(이미지)' : '제목 없음';
  }
  const category = sel && sel.value && QA_CAT_META[sel.value] ? sel.value : 'general';
  const author = getTradeAuthorForPost();
  const uid = cachedAuthUserForProfile && cachedAuthUserForProfile.id ? cachedAuthUserForProfile.id : null;
  const authorGuestKey = uid ? null : getOrCreateTradeGuestId();
  const now = Date.now();
  const post = normalizeQaPost({
    id: `${now}_${Math.random().toString(36).slice(2, 10)}`,
    category,
    title,
    authorName: author.name,
    avatarUrl: author.avatarUrl || '',
    authorInitial: author.initial,
    body,
    ts: now,
    updatedAt: now,
    userId: uid,
    authorGuestKey,
    reactions: normalizeReactionMap(null),
    reactionsByUser: {},
    attachments: attachSnap,
    comments: []
  });
  const posts = loadQaPosts();
  posts.unshift(post);
  saveQaPosts(posts);
  if (ta) ta.value = '';
  if (titleIn) titleIn.value = '';
  qaComposePendingAttachments = [];
  renderQaComposeAttachPreview();
  renderQaMessages();
}

function qaToggleReaction(postId, reactionKey) {
  if (isCurrentTradeActivityBlocked()) {
    alert(tradeRestrictionMessage());
    return;
  }
  if (!postId) return;
  const k = TRADE_REACTION_KEYS.includes(reactionKey) ? reactionKey : 'thumb';
  const posts = loadQaPosts();
  const i = posts.findIndex((x) => x.id === postId);
  if (i === -1) return;
  const cur = posts[i];
  const userKey = getTradeUserKey();
  const ru = normalizeReactionsByUser(cur.reactionsByUser);
  if (ru[userKey] === k) {
    delete ru[userKey];
  } else {
    ru[userKey] = k;
  }
  const next = normalizeQaPost({
    ...cur,
    reactionsByUser: ru,
    updatedAt: Date.now()
  });
  posts[i] = next;
  saveQaPosts(posts);
  renderQaMessages();
  if (selectedQaPostId === postId) renderQaThreadPanel();
}

function buildQaThreadRootHtml(post) {
  const meta = QA_CAT_META[post.category] || QA_CAT_META.general;
  const initial = escapeHtmlTrade((post.authorInitial || (post.authorName || '?').charAt(0)).toUpperCase());
  const avatarInner = post.avatarUrl
    ? `<img src="${escapeHtmlTrade(post.avatarUrl)}" alt="">`
    : `<span>${initial}</span>`;
  const guestId = getOrCreateTradeGuestId();
  const isSelf =
    (post.userId && currentAuthUserId && String(post.userId) === String(currentAuthUserId)) ||
    (!post.userId && post.authorGuestKey && post.authorGuestKey === guestId);
  const authorTag = isSelf ? '<span class="trade-author-tag">작성자</span>' : '';
  const imgs =
    post.attachments && post.attachments.length
      ? `<div class="trade-thread-images">${post.attachments
          .map(
            (a) =>
              `<img src="${escapeHtmlTrade(a.dataUrl)}" alt="${escapeHtmlTrade(a.name)}">`
          )
          .join('')}</div>`
      : '';
  const counts = deriveReactionCountsFromPost(post);
  const ru = normalizeReactionsByUser(post.reactionsByUser);
  const myKey = getTradeUserKey();
  const mine = ru[myKey];
  const reactBtns = TRADE_REACTION_KEYS.map((key) => {
    const em = TRADE_REACTION_META[key].emoji;
    const cnt = counts[key] || 0;
    const active = mine === key ? ' trade-thread-react-active' : '';
    return `<button type="button" class="trade-thread-react-btn${active}" data-trade-thread-react="${key}">${em} ${cnt}</button>`;
  }).join('');
  return `<div class="trade-msg-row">
    <div class="trade-msg-avatar">${avatarInner}</div>
    <div class="trade-msg-main">
      <div class="trade-msg-head">
        <span class="trade-msg-author">${escapeHtmlTrade(post.authorName || '알 수 없음')}</span>
        ${authorTag}
        <span class="trade-badge ${meta.cls}">${escapeHtmlTrade(meta.badge)}</span>
        <span class="trade-msg-time">${escapeHtmlTrade(formatTradeTimestamp(post.ts))}</span>
      </div>
      <div class="trade-thread-root-body">${escapeHtmlTrade(post.body || '').replace(/\n/g, '<br>')}</div>
      ${imgs}
      <div class="trade-thread-reactions">${reactBtns}</div>
    </div>
  </div>`;
}

function ensureQaThreadPanelBindings() {
  const panel = document.getElementById('qaThreadPanel');
  if (!panel || panel.__qaReactBound) return;
  panel.__qaReactBound = true;
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-trade-thread-react]');
    if (!btn || !selectedQaPostId) return;
    e.preventDefault();
    e.stopPropagation();
    qaOpenReactionEmoji(btn, selectedQaPostId);
  });
}

function renderQaThreadPanel() {
  const rootEl = document.getElementById('qaThreadRootBlock');
  const comEl = document.getElementById('qaThreadComments');
  const titleEl = document.getElementById('qaThreadTitle');
  const sc = document.getElementById('qaThreadScroll');
  if (!rootEl || !comEl || !titleEl) return;
  if (!selectedQaPostId) return;
  const posts = loadQaPosts();
  const post = posts.find((x) => x.id === selectedQaPostId);
  if (!post) {
    closeQaThreadPanel();
    return;
  }
  titleEl.textContent = post.title || '제목 없음';
  rootEl.innerHTML = buildQaThreadRootHtml(post);
  comEl.innerHTML = buildTradeCommentsHtml(post);
  if (sc) sc.scrollTop = sc.scrollHeight;
  updateQaThreadMoreMenuVisibility();
  updateTradeRestrictionUI();
}

function closeQaThreadMoreMenu() {
  const menu = document.getElementById('qaThreadMoreMenu');
  const b = document.getElementById('qaThreadMoreBtn');
  if (menu) menu.hidden = true;
  if (b) b.setAttribute('aria-expanded', 'false');
}

function toggleQaThreadMoreMenu(ev) {
  if (ev) ev.stopPropagation();
  const menu = document.getElementById('qaThreadMoreMenu');
  const btn = document.getElementById('qaThreadMoreBtn');
  if (!menu || !btn) return;
  const open = menu.hidden;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function updateQaThreadMoreMenuVisibility() {
  const btn = document.getElementById('qaThreadMoreBtn');
  const wrap = document.querySelector('#qaThreadPanel .trade-thread-more-wrap');
  if (!btn || !wrap) return;
  const post = loadQaPosts().find((x) => x.id === selectedQaPostId);
  const show = !!(post && canModifyQaPost(post));
  btn.hidden = !show;
  wrap.style.display = show ? '' : 'none';
}

function cancelQaThreadEdit() {
  const panel = document.getElementById('qaThreadEditPanel');
  if (panel) panel.hidden = true;
}

function qaThreadEditPost() {
  closeQaThreadMoreMenu();
  const post = loadQaPosts().find((x) => x.id === selectedQaPostId);
  if (!post || !canModifyQaPost(post)) {
    alert('이 글을 수정할 권한이 없습니다.');
    return;
  }
  const panel = document.getElementById('qaThreadEditPanel');
  const ti = document.getElementById('qaEditTitle');
  const tb = document.getElementById('qaEditBody');
  if (ti) ti.value = post.title || '';
  if (tb) tb.value = post.body || '';
  if (panel) panel.hidden = false;
}

function saveQaThreadEdit() {
  if (!selectedQaPostId) return;
  const posts = loadQaPosts();
  const i = posts.findIndex((x) => x.id === selectedQaPostId);
  if (i === -1) return;
  const cur = posts[i];
  if (!canModifyQaPost(cur)) {
    alert('이 글을 수정할 권한이 없습니다.');
    return;
  }
  const ti = document.getElementById('qaEditTitle');
  const tb = document.getElementById('qaEditBody');
  let title = ti ? ti.value.trim() : '';
  const body = tb ? tb.value.trim() : '';
  if (!body) {
    alert('본문을 입력해 주세요.');
    return;
  }
  if (!title) {
    const line = body.split(/\r?\n/)[0] || '';
    title = line ? (line.length > 80 ? `${line.slice(0, 80)}…` : line) : '제목 없음';
  }
  posts[i] = normalizeQaPost({
    ...cur,
    title,
    body,
    updatedAt: Date.now()
  });
  saveQaPosts(posts);
  cancelQaThreadEdit();
  const titleEl = document.getElementById('qaThreadTitle');
  if (titleEl) titleEl.textContent = title;
  const replyTa = document.getElementById('qaReplyBody');
  if (replyTa) replyTa.placeholder = `"${title}"에 답변 남기기`;
  renderQaThreadPanel();
  renderQaMessages();
}

function qaThreadDeletePost() {
  closeQaThreadMoreMenu();
  const post = loadQaPosts().find((x) => x.id === selectedQaPostId);
  if (!post || !canModifyQaPost(post)) {
    alert('이 글을 삭제할 권한이 없습니다.');
    return;
  }
  if (!confirm('이 질문을 삭제할까요? 되돌릴 수 없습니다.')) return;
  const pid = selectedQaPostId;
  const next = loadQaPosts().filter((x) => x.id !== pid);
  saveQaPosts(next);
  closeQaThreadPanel();
  renderQaMessages();
}

function openQaThreadPanel(postId) {
  const posts = loadQaPosts();
  const p = posts.find((x) => x.id === postId);
  if (!p) return;
  selectedQaPostId = postId;
  ensureQaThreadPanelBindings();
  const wrap = document.getElementById('qaHubWrap');
  const panel = document.getElementById('qaThreadPanel');
  if (wrap) wrap.classList.add('trade-split-open');
  if (panel) {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
  }
  const tb = document.getElementById('qaReplyBody');
  const t = p.title || '질문';
  if (tb) tb.placeholder = `"${t}"에 답변 남기기`;
  renderQaThreadPanel();
  document.querySelectorAll('.trade-forum-card[data-qa-post-id]').forEach((c) => {
    c.classList.toggle('trade-card-active', c.getAttribute('data-qa-post-id') === postId);
  });
  updateQaThreadMoreMenuVisibility();
}

function closeQaThreadPanel() {
  closeQaThreadMoreMenu();
  cancelQaThreadEdit();
  selectedQaPostId = null;
  qaReplyPendingAttachments = [];
  renderQaReplyAttachPreview();
  const tb = document.getElementById('qaReplyBody');
  if (tb) tb.value = '';
  const wrap = document.getElementById('qaHubWrap');
  const panel = document.getElementById('qaThreadPanel');
  if (wrap) wrap.classList.remove('trade-split-open');
  if (panel) {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('.trade-forum-card[data-qa-post-id]').forEach((c) => c.classList.remove('trade-card-active'));
  updateQaThreadMoreMenuVisibility();
}

function submitQaReply() {
  if (isCurrentTradeActivityBlocked()) {
    alert(tradeRestrictionMessage());
    return;
  }
  if (!selectedQaPostId) return;
  const ta = document.getElementById('qaReplyBody');
  const body = ta ? ta.value.trim() : '';
  const imgs = qaReplyPendingAttachments.map(normalizeTradeAttachment).filter(Boolean);
  if (!body && !imgs.length) {
    alert('답변 내용을 입력하거나 이미지를 첨부해 주세요.');
    return;
  }
  const posts = loadQaPosts();
  const i = posts.findIndex((x) => x.id === selectedQaPostId);
  if (i === -1) return;
  const author = getTradeAuthorForPost();
  const uid = cachedAuthUserForProfile && cachedAuthUserForProfile.id ? cachedAuthUserForProfile.id : null;
  const authorGuestKey = uid ? null : getOrCreateTradeGuestId();
  const comment = normalizeTradeComment({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    authorName: author.name,
    avatarUrl: author.avatarUrl || '',
    authorInitial: author.initial,
    body,
    ts: Date.now(),
    userId: uid,
    authorGuestKey,
    attachments: imgs
  });
  const cur = posts[i];
  const nextComments = (cur.comments || []).concat(comment);
  posts[i] = normalizeQaPost({ ...cur, comments: nextComments, updatedAt: Date.now() });
  saveQaPosts(posts);
  if (ta) ta.value = '';
  qaReplyPendingAttachments = [];
  renderQaReplyAttachPreview();
  renderQaThreadPanel();
  renderQaMessages();
}
