/* =========================================================
   ALIYAH NOW — Frontend App
   Bulletin Board (Supabase) + AI Debate Chat
   ========================================================= */

// =========================================================
// CONFIG — injected via data attributes on <body>
// =========================================================
const SUPABASE_URL     = document.body.dataset.supabaseUrl  || '';
const SUPABASE_ANON    = document.body.dataset.supabaseAnon || '';
const SUPABASE_ENABLED = SUPABASE_URL.length > 0 && SUPABASE_URL !== 'YOUR_SUPABASE_URL';

// =========================================================
// SUPABASE CLIENT
// =========================================================
let db = null; // named 'db' to avoid clash with window.supabase from CDN

function initSupabase() {
  if (!SUPABASE_ENABLED) return;
  try {
    // @supabase/supabase-js is loaded via CDN in index.html
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } catch (err) {
    console.warn('Supabase init failed, falling back to demo mode:', err);
    db = null;
  }
}

// =========================================================
// SAMPLE SEED DATA (shown when Supabase not connected)
// =========================================================
const SEED_POSTS = [
  { id: 'seed-1', name: 'Anonymous', city: 'New York', excuse: "My whole career is here. My network, my clients, everything I've built over 15 years. Starting over in a new country at 38 isn't realistic.", category: 'Career', votes: 142, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'seed-2', name: 'Anonymous', city: 'Los Angeles', excuse: "My parents are getting older. There is no version of my life where I move to another continent and leave them behind. Period.", category: 'Family', votes: 88, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'seed-3', name: 'Anonymous', city: 'Chicago', excuse: "I'm American first. Being Jewish is part of my identity, but it doesn't mean I have an obligation to live somewhere else.", category: 'Identity', votes: 71, created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'seed-4', name: 'Anonymous', city: 'Miami', excuse: "The security situation in Israel makes me nervous. I have kids. I can't put them in a war zone.", category: 'Safety', votes: 103, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'seed-5', name: 'Anonymous', city: 'New Jersey', excuse: "I don't speak Hebrew. I'm 45. Learning a new language at this stage of my life feels impossible.", category: 'Language', votes: 56, created_at: new Date(Date.now() - 3600000 * 6).toISOString() },
  { id: 'seed-6', name: 'Anonymous', city: 'Boston', excuse: "I've visited Israel and I love it. But the bureaucracy, the cost of living, the apartment sizes — the quality of life just isn't what I have here.", category: 'Lifestyle', votes: 39, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
];

// =========================================================
// STATE
// =========================================================
const state = {
  posts: [],
  activeFilter: 'all',
  page: 0,
  pageSize: 6,
  votedPosts: new Set(JSON.parse(localStorage.getItem('votedPosts') || '[]')),
  chat: {
    messages: [],   // [{role, content}]
    loading: false,
  },
};

// =========================================================
// BULLETIN BOARD
// =========================================================

async function loadPosts() {
  if (!SUPABASE_ENABLED) {
    state.posts = [...SEED_POSTS];
    renderPosts();
    updatePostCount();
    return;
  }

  showSkeletons();

  try {
    let query = db
      .from('excuses')
      .select('*')
      .order('created_at', { ascending: false });

    if (state.activeFilter !== 'all') {
      query = query.eq('category', state.activeFilter);
    }

    const { data, error } = await query.range(
      state.page * state.pageSize,
      (state.page + 1) * state.pageSize - 1
    );

    if (error) throw error;
    state.posts = data || [];
    renderPosts();
    updatePostCount();
  } catch (err) {
    console.error('Failed to load posts:', err);
    state.posts = [...SEED_POSTS];
    renderPosts();
    updatePostCount();
    showConfigNotice();
  }
}

function showSkeletons() {
  const feed = document.getElementById('posts-feed');
  if (!feed) return;
  feed.innerHTML = Array(3).fill('<div class="skeleton skeleton-post"></div>').join('');
}

function renderPosts() {
  const feed = document.getElementById('posts-feed');
  if (!feed) return;

  const filtered = state.activeFilter === 'all'
    ? state.posts
    : state.posts.filter(p => p.category === state.activeFilter);

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div class="posts-empty">
        <p class="posts-empty-text">No excuses yet.</p>
        <p class="posts-empty-sub">Be the first to post your reason.</p>
      </div>`;
    return;
  }

  feed.innerHTML = filtered.map(post => renderPostCard(post)).join('');

  // Bind vote + debate buttons
  feed.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn.dataset.postId, btn));
  });
  feed.querySelectorAll('.debate-btn').forEach(btn => {
    btn.addEventListener('click', () => populateChatWithExcuse(btn.dataset.excuse));
  });
}

function renderPostCard(post) {
  const hasVoted  = state.votedPosts.has(post.id);
  const timeAgo   = formatTimeAgo(post.created_at);
  const catClass  = getCategoryClass(post.category);

  return `
    <div class="post-card" data-id="${post.id}">
      <div class="post-meta">
        <span class="post-author">${escapeHtml(post.name || 'Anonymous')}${post.city ? ' · ' + escapeHtml(post.city) : ''}</span>
        <span class="post-time">${timeAgo}</span>
        ${post.category ? `<span class="tag ${catClass}">${escapeHtml(post.category)}</span>` : ''}
      </div>
      <p class="post-text">"${escapeHtml(post.excuse)}"</p>
      <div class="post-actions">
        <button class="vote-btn ${hasVoted ? 'voted' : ''}" data-post-id="${post.id}">
          ▲ ${post.votes || 0} agree
        </button>
        <button class="debate-btn" data-excuse="${escapeHtml(post.excuse)}">
          Debate This →
        </button>
      </div>
    </div>`;
}

function getCategoryClass(category) {
  const map = {
    'Career':   'tag-outline',
    'Family':   'tag-orange',
    'Identity': 'tag-yellow',
    'Safety':   'tag-ghost',
    'Language': 'tag-ghost',
    'Lifestyle':'tag-ghost',
    'Other':    'tag-ghost',
  };
  return map[category] || 'tag-ghost';
}

async function handleVote(postId, btn) {
  if (state.votedPosts.has(postId)) return;

  state.votedPosts.add(postId);
  localStorage.setItem('votedPosts', JSON.stringify([...state.votedPosts]));
  btn.classList.add('voted');

  // Optimistic UI: parse current count and increment
  const match = btn.textContent.match(/(\d+)/);
  if (match) {
    const newCount = parseInt(match[1], 10) + 1;
    btn.textContent = `▲ ${newCount} agree`;
  }

  if (!SUPABASE_ENABLED) return;

  try {
    // Supabase RPC to increment votes safely
    await db.rpc('increment_votes', { row_id: postId });
  } catch (err) {
    console.error('Vote error:', err);
  }
}

function updatePostCount() {
  const el = document.getElementById('post-count');
  if (el) el.textContent = `${state.posts.length}${SUPABASE_ENABLED ? '' : '+'} excuses posted`;
}

// Form submission
function initPostForm() {
  const form = document.getElementById('post-form');
  if (!form) return;

  const textarea = form.querySelector('#excuse-text');
  const counter  = form.querySelector('#char-counter');

  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      const max = 280;
      counter.textContent = `${len} / ${max}`;
      counter.classList.toggle('warn', len > max * 0.85);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.form-submit-btn');
    const data = new FormData(form);

    const excuse   = data.get('excuse')?.trim();
    const category = data.get('category');
    const name     = data.get('name')?.trim() || 'Anonymous';
    const city     = data.get('city')?.trim() || '';

    if (!excuse || excuse.length < 10) {
      showFieldError('excuse-text', 'Please write at least 10 characters.');
      return;
    }
    if (excuse.length > 280) {
      showFieldError('excuse-text', 'Keep it under 280 characters.');
      return;
    }

    btn.textContent = 'Posting...';
    btn.disabled = true;

    const newPost = {
      id: `local-${Date.now()}`,
      name, city, excuse, category,
      votes: 0,
      created_at: new Date().toISOString(),
    };

    if (SUPABASE_ENABLED) {
      try {
        const { data: inserted, error } = await db
          .from('excuses')
          .insert([{ name, city, excuse, category }])
          .select()
          .single();
        if (error) throw error;
        newPost.id = inserted.id;
      } catch (err) {
        console.error('Insert error:', err);
        showToast('Could not save post. Showing locally.', 'error');
      }
    }

    // Prepend to feed
    state.posts.unshift(newPost);
    renderPosts();
    updatePostCount();
    form.reset();
    if (counter) counter.textContent = '0 / 280';
    btn.textContent = 'Post My Excuse →';
    btn.disabled = false;
    showToast('Your excuse has been posted.');

    // Scroll to feed on mobile
    if (window.innerWidth < 1024) {
      document.getElementById('posts-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function showFieldError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.style.borderColor = 'var(--color-orange)';
  let err = field.parentElement.querySelector('.form-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'form-error';
    field.parentElement.appendChild(err);
  }
  err.textContent = msg;
  setTimeout(() => {
    field.style.borderColor = '';
    err.remove();
  }, 3000);
}

function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderPosts();
    });
  });
}

function showConfigNotice() {
  const existing = document.getElementById('config-notice');
  if (existing) return;

  const notice = document.createElement('div');
  notice.id = 'config-notice';
  notice.className = 'config-notice';
  notice.innerHTML = `
    <p class="config-notice-title">Demo Mode — Supabase not connected</p>
    <p class="config-notice-text">
      Add your <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> to
      <code>.env.local</code> to enable shared posts across visitors.
      See the setup instructions in the README.
    </p>`;

  const wall = document.getElementById('wall');
  const container = wall?.querySelector('.container');
  if (container) container.prepend(notice);
}

// =========================================================
// CHAT / DEBATE AI
// =========================================================

const OPENING_MESSAGE = {
  role: 'assistant',
  content: "Alright — you've found your way to the Debate. Go ahead: tell me your best reason for not making aliyah. I'll listen carefully. And then I'll push back.\n\nWhat's stopping you?",
};

function initChat() {
  state.chat.messages = [];
  renderMessages([OPENING_MESSAGE]);

  const form  = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const reset = document.getElementById('chat-reset');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input?.value?.trim();
      if (!text || state.chat.loading) return;
      await sendChatMessage(text);
    });
  }

  if (reset) {
    reset.addEventListener('click', () => {
      state.chat.messages = [];
      renderMessages([OPENING_MESSAGE]);
    });
  }

  // Enter to send (shift+enter for newline)
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.dataset.prompt;
      input?.focus();
    });
  });
}

async function sendChatMessage(text) {
  const input  = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  state.chat.messages.push({ role: 'user', content: text });
  if (input) input.value = '';
  if (sendBtn) sendBtn.disabled = true;
  state.chat.loading = true;

  renderMessages([...state.chat.messages]);
  showTypingIndicator(true);
  scrollChatToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.chat.messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const { reply } = await res.json();
    state.chat.messages.push({ role: 'assistant', content: reply });
    showTypingIndicator(false);
    renderMessages([...state.chat.messages]);
    scrollChatToBottom();
  } catch (err) {
    console.error('Chat error:', err);
    showTypingIndicator(false);
    state.chat.messages.push({
      role: 'assistant',
      content: "Something went wrong on my end. Make sure your ANTHROPIC_API_KEY is set. Try again?",
    });
    renderMessages([...state.chat.messages]);
    scrollChatToBottom();
  } finally {
    state.chat.loading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Keep typing indicator element
  const typingEl = document.getElementById('typing-indicator');

  container.innerHTML = messages.map(msg => `
    <div class="chat-msg ${msg.role === 'assistant' ? 'bot' : 'user'}">
      <span class="chat-sender">${msg.role === 'assistant' ? 'Debate AI' : 'You'}</span>
      <div class="chat-bubble">${formatChatText(escapeHtml(msg.content))}</div>
    </div>`).join('');

  // Re-append typing indicator
  if (typingEl) container.appendChild(typingEl);
}

function showTypingIndicator(show) {
  const el = document.getElementById('typing-indicator');
  if (!el) return;
  el.classList.toggle('visible', show);
  if (show) scrollChatToBottom();
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }
}

function populateChatWithExcuse(excuse) {
  const section = document.getElementById('debate');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = excuse;
      input.focus();
    }
  }, 600);
}

// =========================================================
// EMAIL NEWSLETTER FORM
// =========================================================
function initEmailForm() {
  const form = document.getElementById('email-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('.email-input')?.value?.trim();
    if (!email) return;
    // In production: connect to Mailchimp, ConvertKit, Buttondown, etc.
    showToast('You\'re on the list. Stay tuned.');
    form.reset();
  });
}

// =========================================================
// NAVIGATION
// =========================================================
function initNav() {
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    // Close on link click
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // Highlight active section on scroll
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navItems.forEach(a => a.style.color = '');
        const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (active) active.style.color = 'var(--color-yellow)';
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
}

// =========================================================
// UTILITIES
// =========================================================

function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  if (type === 'error') {
    toast.style.background = 'var(--color-orange)';
    toast.style.color = 'var(--color-white)';
  } else {
    toast.style.background = 'var(--color-yellow)';
    toast.style.color = 'var(--color-black)';
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatChatText(text) {
  // Convert newlines to <br>, preserve paragraphs
  return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
}

function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =========================================================
// COUNTER ANIMATIONS (on scroll)
// =========================================================
function initCounters() {
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (!statNumbers.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = el.dataset.target;

      // Handle non-numeric targets like "∞" or "30%"
      if (isNaN(parseFloat(target))) {
        el.textContent = target;
        observer.unobserve(el);
        return;
      }

      const isFloat  = target.includes('.');
      const suffix   = el.dataset.suffix || '';
      const num      = parseFloat(target);
      const duration = 1400;
      const start    = performance.now();

      const animate = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        const current  = num * eased;
        el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => observer.observe(el));
}

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  const inits = [initSupabase, initNav, loadPosts, initPostForm, initFilters, initChat, initEmailForm, initCounters];
  inits.forEach(fn => {
    try { fn(); } catch (err) { console.error(`${fn.name} failed:`, err); }
  });
});
