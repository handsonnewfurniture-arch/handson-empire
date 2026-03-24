// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ═══ SCROLL NAVIGATION SIDEBAR ═══
function initScrollNav() {
  const navItems = [
    { icon: '🏠', label: 'Dashboard', href: '/worker/dashboard.html' },
    { icon: '📋', label: 'Lead Feed', href: '/worker/' },
    { icon: '📷', label: 'Portfolio', href: '/worker/portfolio.html' },
    { icon: '🤖', label: 'AI Assistant', action: 'openBot' }
  ];

  const nav = document.createElement('div');
  nav.id = 'scrollNav';
  nav.innerHTML = `
    <style>
      #scrollNav {
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 500;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .scroll-nav-item {
        width: 48px;
        height: 48px;
        background: rgba(15, 22, 35, 0.95);
        border: 1px solid #1e293b;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        position: relative;
      }

      .scroll-nav-item:hover {
        background: rgba(249, 115, 22, 0.15);
        border-color: #f97316;
        transform: scale(1.1);
      }

      .scroll-nav-item.active {
        background: #f97316;
        border-color: #f97316;
      }

      .scroll-nav-tooltip {
        position: absolute;
        right: 56px;
        background: #0f1623;
        border: 1px solid #1e293b;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #f1f5f9;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }

      .scroll-nav-item:hover .scroll-nav-tooltip {
        opacity: 1;
      }

      .scroll-nav-divider {
        height: 1px;
        background: #1e293b;
        margin: 4px 8px;
      }

      @media (max-width: 768px) {
        #scrollNav {
          right: 8px;
          bottom: 80px;
          top: auto;
          transform: none;
        }

        .scroll-nav-item {
          width: 44px;
          height: 44px;
          font-size: 18px;
        }

        .scroll-nav-tooltip {
          display: none;
        }
      }
    </style>

    ${navItems.map(item => `
      ${item.divider ? '<div class="scroll-nav-divider"></div>' : ''}
      <${item.href ? 'a' : 'button'}
        class="scroll-nav-item ${window.location.pathname === item.href ? 'active' : ''}"
        ${item.href ? `href="${item.href}"` : ''}
        ${item.action ? `onclick="${item.action}()"` : ''}
      >
        ${item.icon}
        <span class="scroll-nav-tooltip">${item.label}</span>
      </${item.href ? 'a' : 'button'}>
    `).join('')}
  `;

  document.body.appendChild(nav);
}

// ═══ AI LEAD BOT ASSISTANT ═══
function initLeadBot() {
  const bot = document.createElement('div');
  bot.id = 'leadBot';
  bot.innerHTML = `
    <style>
      #leadBot {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 1000;
      }

      .bot-trigger {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #f97316, #ea580c);
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);
        transition: all 0.3s ease;
      }

      .bot-trigger:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 30px rgba(249, 115, 22, 0.5);
      }

      .bot-trigger.has-notification::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 16px;
        height: 16px;
        background: #ef4444;
        border-radius: 50%;
        border: 3px solid #0a0f1a;
      }

      .bot-panel {
        position: absolute;
        bottom: 70px;
        left: 0;
        width: 360px;
        max-height: 500px;
        background: #0f1623;
        border: 1px solid #1e293b;
        border-radius: 16px;
        overflow: hidden;
        display: none;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      }

      .bot-panel.active {
        display: flex;
        animation: botSlideIn 0.3s ease-out;
      }

      @keyframes botSlideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .bot-header {
        background: linear-gradient(135deg, #f97316, #ea580c);
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .bot-avatar {
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .bot-title {
        flex: 1;
        color: white;
      }

      .bot-title h3 {
        font-size: 14px;
        font-weight: 700;
        margin: 0;
      }

      .bot-title p {
        font-size: 11px;
        opacity: 0.8;
        margin: 2px 0 0;
      }

      .bot-close {
        background: rgba(255,255,255,0.2);
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }

      .bot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 300px;
      }

      .bot-message {
        display: flex;
        gap: 8px;
        animation: messageIn 0.3s ease-out;
      }

      @keyframes messageIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .bot-message.user {
        flex-direction: row-reverse;
      }

      .bot-message-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #f97316;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }

      .bot-message.user .bot-message-avatar {
        background: #1e293b;
      }

      .bot-message-content {
        background: #1e293b;
        padding: 10px 14px;
        border-radius: 12px;
        border-top-left-radius: 4px;
        max-width: 80%;
        font-size: 13px;
        line-height: 1.5;
        color: #e2e8f0;
      }

      .bot-message.user .bot-message-content {
        background: rgba(249, 115, 22, 0.2);
        border-radius: 12px;
        border-top-right-radius: 4px;
      }

      .bot-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .bot-suggestion {
        background: rgba(249, 115, 22, 0.1);
        border: 1px solid rgba(249, 115, 22, 0.3);
        color: #f97316;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .bot-suggestion:hover {
        background: rgba(249, 115, 22, 0.2);
        border-color: #f97316;
      }

      .bot-input-area {
        padding: 12px 16px;
        border-top: 1px solid #1e293b;
        display: flex;
        gap: 8px;
      }

      .bot-input {
        flex: 1;
        background: #0a0f1a;
        border: 1px solid #1e293b;
        border-radius: 20px;
        padding: 10px 16px;
        color: #f1f5f9;
        font-size: 13px;
      }

      .bot-input:focus {
        outline: none;
        border-color: #f97316;
      }

      .bot-send {
        width: 40px;
        height: 40px;
        background: #f97316;
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .bot-send:hover {
        background: #ea580c;
      }

      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 8px 0;
      }

      .typing-dot {
        width: 8px;
        height: 8px;
        background: #64748b;
        border-radius: 50%;
        animation: typingBounce 1.4s infinite ease-in-out;
      }

      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typingBounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }

      @media (max-width: 480px) {
        .bot-panel {
          width: calc(100vw - 40px);
          bottom: 70px;
          left: 0;
          right: 20px;
        }
      }
    </style>

    <button class="bot-trigger" onclick="toggleBot()">🤖</button>

    <div class="bot-panel" id="botPanel">
      <div class="bot-header">
        <div class="bot-avatar">🤖</div>
        <div class="bot-title">
          <h3>LeadBot AI</h3>
          <p>Your deal-finding assistant</p>
        </div>
        <button class="bot-close" onclick="toggleBot()">✕</button>
      </div>

      <div class="bot-messages" id="botMessages">
        <div class="bot-message">
          <div class="bot-message-avatar">🤖</div>
          <div class="bot-message-content">
            Hey! I'm LeadBot, your AI assistant. I can help you:
            <div class="bot-suggestions">
              <button class="bot-suggestion" onclick="botAction('hot-leads')">🔥 Find hot leads</button>
              <button class="bot-suggestion" onclick="botAction('my-stats')">📊 View my stats</button>
              <button class="bot-suggestion" onclick="botAction('best-trades')">💰 Best paying trades</button>
              <button class="bot-suggestion" onclick="botAction('navigate')">🧭 Navigate site</button>
            </div>
          </div>
        </div>
      </div>

      <div class="bot-input-area">
        <input type="text" class="bot-input" id="botInput" placeholder="Ask me anything..." onkeypress="if(event.key==='Enter')sendBotMessage()">
        <button class="bot-send" onclick="sendBotMessage()">➤</button>
      </div>
    </div>
  `;

  document.body.appendChild(bot);
}

let botOpen = false;

function toggleBot() {
  botOpen = !botOpen;
  document.getElementById('botPanel').classList.toggle('active', botOpen);
  if (botOpen) {
    document.getElementById('botInput').focus();
  }
}

function openBot() {
  if (!botOpen) toggleBot();
}

function addBotMessage(content, isUser = false) {
  const messages = document.getElementById('botMessages');
  const msg = document.createElement('div');
  msg.className = `bot-message ${isUser ? 'user' : ''}`;
  msg.innerHTML = `
    <div class="bot-message-avatar">${isUser ? '👤' : '🤖'}</div>
    <div class="bot-message-content">${content}</div>
  `;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  const messages = document.getElementById('botMessages');
  const typing = document.createElement('div');
  typing.className = 'bot-message';
  typing.id = 'typingIndicator';
  typing.innerHTML = `
    <div class="bot-message-avatar">🤖</div>
    <div class="bot-message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById('typingIndicator');
  if (typing) typing.remove();
}

async function sendBotMessage() {
  const input = document.getElementById('botInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addBotMessage(text, true);

  showTyping();

  // Simulate AI response delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
  hideTyping();

  // Process message
  const response = processBotQuery(text.toLowerCase());
  addBotMessage(response);
}

async function botAction(action) {
  showTyping();
  await new Promise(r => setTimeout(r, 600));
  hideTyping();

  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

  switch (action) {
    case 'hot-leads':
      try {
        const res = await fetch(`${API_URL}/api/leads?priority=CRITICAL`);
        const { leads } = await res.json();
        const count = leads?.length || 0;

        if (count > 0) {
          addBotMessage(`
            🔥 <strong>Found ${count} hot leads!</strong><br><br>
            Top opportunity:<br>
            <strong>${leads[0].title}</strong><br>
            ${leads[0].city} • $${leads[0].revenue?.toLocaleString() || 'TBD'}<br><br>
            <div class="bot-suggestions">
              <button class="bot-suggestion" onclick="window.location.href='/worker/'">View All Leads</button>
            </div>
          `);
        } else {
          addBotMessage(`No critical leads right now. Check back soon or browse all leads!
            <div class="bot-suggestions">
              <button class="bot-suggestion" onclick="window.location.href='/worker/'">Browse Leads</button>
            </div>
          `);
        }
      } catch (e) {
        addBotMessage('Error fetching leads. Try refreshing the page.');
      }
      break;

    case 'my-stats':
      const user = JSON.parse(localStorage.getItem('handson_user') || '{}');
      addBotMessage(`
        📊 <strong>Your Stats</strong><br><br>
        ⭐ Rating: ${user.rating?.toFixed(1) || '5.0'}<br>
        🔧 Jobs Completed: ${user.jobs || 0}<br>
        💰 Total Earned: $${(user.total_earnings || 0).toLocaleString()}<br><br>
        <div class="bot-suggestions">
          <button class="bot-suggestion" onclick="window.location.href='/worker/dashboard.html'">Go to Dashboard</button>
          <button class="bot-suggestion" onclick="window.location.href='/worker/portfolio.html'">View Portfolio</button>
        </div>
      `);
      break;

    case 'best-trades':
      addBotMessage(`
        💰 <strong>Highest Paying Trades</strong><br><br>
        1. ⚡ Electrical - Avg $350/job<br>
        2. 🚰 Plumbing - Avg $280/job<br>
        3. ❄️ HVAC - Avg $250/job<br>
        4. 🔨 Roofing - Avg $220/job<br>
        5. 🎨 Painting - Avg $180/job<br><br>
        <div class="bot-suggestions">
          <button class="bot-suggestion" onclick="botAction('hot-leads')">Find leads in these</button>
        </div>
      `);
      break;

    case 'navigate':
      addBotMessage(`
        🧭 <strong>Quick Navigation</strong><br><br>
        Where do you want to go?
        <div class="bot-suggestions">
          <button class="bot-suggestion" onclick="window.location.href='/worker/'">📋 Lead Feed</button>
          <button class="bot-suggestion" onclick="window.location.href='/worker/dashboard.html'">🏠 Dashboard</button>
          <button class="bot-suggestion" onclick="window.location.href='/worker/portfolio.html'">📷 Portfolio</button>
        </div>
      `);
      break;
  }
}

function processBotQuery(text) {
  // Simple keyword matching for common queries
  if (text.includes('lead') || text.includes('deal') || text.includes('job') || text.includes('work')) {
    return `
      Looking for work? Here's what I can help with:
      <div class="bot-suggestions">
        <button class="bot-suggestion" onclick="botAction('hot-leads')">🔥 Hot Leads</button>
        <button class="bot-suggestion" onclick="window.location.href='/worker/'">📋 All Leads</button>
      </div>
    `;
  }

  if (text.includes('earn') || text.includes('money') || text.includes('pay') || text.includes('income')) {
    return `
      Want to see your earnings?
      <div class="bot-suggestions">
        <button class="bot-suggestion" onclick="botAction('my-stats')">📊 My Stats</button>
        <button class="bot-suggestion" onclick="botAction('best-trades')">💰 Best Paying Trades</button>
      </div>
    `;
  }

  if (text.includes('portfolio') || text.includes('photo') || text.includes('picture')) {
    return `
      Your portfolio showcases your best work to potential customers!
      <div class="bot-suggestions">
        <button class="bot-suggestion" onclick="window.location.href='/worker/portfolio.html'">📷 View Portfolio</button>
      </div>
    `;
  }

  if (text.includes('help') || text.includes('how')) {
    return `
      I'm here to help! What do you need?
      <div class="bot-suggestions">
        <button class="bot-suggestion" onclick="botAction('navigate')">🧭 Navigate</button>
        <button class="bot-suggestion" onclick="botAction('hot-leads')">🔥 Find Leads</button>
        <button class="bot-suggestion" onclick="botAction('my-stats')">📊 My Stats</button>
      </div>
    `;
  }

  if (text.includes('hi') || text.includes('hello') || text.includes('hey')) {
    return `
      Hey there! 👋 How can I help you find more deals today?
      <div class="bot-suggestions">
        <button class="bot-suggestion" onclick="botAction('hot-leads')">🔥 Hot Leads</button>
        <button class="bot-suggestion" onclick="botAction('navigate')">🧭 Navigate</button>
      </div>
    `;
  }

  // Default response
  return `
    I can help you with:
    <div class="bot-suggestions">
      <button class="bot-suggestion" onclick="botAction('hot-leads')">🔥 Find hot leads</button>
      <button class="bot-suggestion" onclick="botAction('my-stats')">📊 View stats</button>
      <button class="bot-suggestion" onclick="botAction('navigate')">🧭 Navigate site</button>
    </div>
  `;
}

// Expose functions globally for onclick handlers
window.toggleBot = toggleBot;
window.openBot = openBot;
window.botAction = botAction;
window.sendBotMessage = sendBotMessage;

// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initScrollNav();
  initLeadBot();
});
