/**
 * CharRole UI Module
 * Handles all UI interactions and rendering
 */

class UIManager {
  constructor() {
    this.elements = {};
    this.cacheElements();
    this.bindEvents();
    this.setupStoreListeners();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      // Header
      apiStatus: document.getElementById('apiStatus'),
      savedCount: document.getElementById('savedCount'),
      
      // Search
      searchInput: document.getElementById('searchInput'),
      generateBtn: document.getElementById('generateBtn'),
      
      // Loading
      loadingArea: document.getElementById('loadingArea'),
      progressText: document.getElementById('progressText'),
      
      // Results
      resultArea: document.getElementById('resultArea'),
      
      // Chat
      chatPanel: document.getElementById('chatPanel'),
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput'),
      chatName: document.getElementById('chatName'),
      chatAvatar: document.getElementById('chatAvatar'),
      
      // Modals
      settingsModal: document.getElementById('settingsModal'),
      saveModal: document.getElementById('saveModal'),
      debateModal: document.getElementById('debateModal'),
      
      // Drawers
      savedDrawer: document.getElementById('savedDrawer'),
      
      // Toast container
      toastContainer: document.getElementById('toastContainer')
    };
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search
    this.elements.searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.generatePersona();
    });

    // Chat input
    this.elements.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.elements.chatInput?.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay, .drawer-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal();
          this.closeDrawer();
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeDrawer();
        if (store.get('isChatOpen')) {
          this.toggleChat();
        }
      }
    });
  }

  /**
   * Setup store listeners
   */
  setupStoreListeners() {
    // API Status
    store.subscribe('apiStatus', (status) => {
      this.updateApiStatus(status);
    });

    // Saved count
    store.subscribe('savedCount', (count) => {
      if (this.elements.savedCount) {
        this.elements.savedCount.textContent = count;
      }
    });

    // Loading state
    store.subscribe('isGenerating', (isGenerating) => {
      this.toggleLoading(isGenerating);
    });

    store.subscribe('generationProgress', (progress) => {
      if (this.elements.progressText) {
        this.elements.progressText.textContent = progress;
      }
    });

    // Current persona
    store.subscribe('currentPersona', (persona) => {
      if (persona) {
        this.renderPersona(persona);
      }
    });

    // Chat state
    store.subscribe('isChatOpen', (isOpen) => {
      this.elements.chatPanel?.classList.toggle('chat-panel--open', isOpen);
    });
  }

  /**
   * Update API status indicator
   */
  updateApiStatus(status) {
    if (!this.elements.apiStatus) return;
    
    const statusMap = {
      none: { text: '未配置', class: 'badge--neutral' },
      ok: { text: '已连接', class: 'badge--success' },
      error: { text: '连接失败', class: 'badge--error' }
    };

    const { text, class: className } = statusMap[status] || statusMap.none;
    this.elements.apiStatus.textContent = text;
    this.elements.apiStatus.className = `badge ${className}`;
  }

  /**
   * Toggle loading state
   */
  toggleLoading(isLoading) {
    this.elements.loadingArea?.classList.toggle('show', isLoading);
    this.elements.generateBtn && (this.elements.generateBtn.disabled = isLoading);
  }

  /**
   * Generate persona
   */
  async generatePersona() {
    const name = this.elements.searchInput?.value.trim();
    if (!name) {
      this.showToast('请输入人物名称', 'warning');
      return;
    }

    try {
      await api.generatePersona(name);
      this.showToast('人物生成成功！', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  /**
   * Render persona card
   */
  renderPersona(persona) {
    if (!this.elements.resultArea) return;

    const html = `
      <div class="persona-card">
        <div class="persona-card__header">
          <div class="persona-card__avatar">
            <img src="${persona.avatar}" alt="${persona.name}" loading="lazy">
          </div>
          <div class="persona-card__info">
            <h2 class="persona-card__name">${persona.emoji} ${persona.name}</h2>
            <p class="persona-card__title">${persona.title || ''}</p>
            <div class="persona-card__actions">
              <button class="btn btn--primary btn--sm" onclick="ui.startChat()">
                💬 开始对话
              </button>
              <button class="btn btn--secondary btn--sm" onclick="ui.openSaveModal()">
                💾 保存
              </button>
              <button class="btn btn--outline btn--sm" onclick="ui.openDebateModal()">
                🔥 论道
              </button>
              <button class="btn btn--ghost btn--sm" onclick="ui.exportPersona()">
                📤 导出
              </button>
            </div>
          </div>
        </div>
        
        <div class="persona-card__body">
          ${this.renderAttributes(persona.attributes)}
          ${this.renderSection('📋 简介', persona.description)}
          ${this.renderSection('🎭 性格', persona.personality)}
          ${this.renderSection('📖 背景', persona.background)}
          ${persona.skills?.length ? this.renderSkills(persona.skills) : ''}
          ${persona.quotes?.length ? this.renderQuotes(persona.quotes) : ''}
          ${persona.chatStyle ? this.renderChatStyle(persona.chatStyle) : ''}
        </div>
      </div>
    `;

    this.elements.resultArea.innerHTML = html;
    this.elements.resultArea.classList.add('show');
    this.elements.resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Render attributes grid
   */
  renderAttributes(attributes) {
    if (!attributes) return '';
    
    const icons = {
      intelligence: '🧠',
      charisma: '✨',
      creativity: '🎨',
      wisdom: '📚',
      humor: '😄'
    };

    const labels = {
      intelligence: '智力',
      charisma: '魅力',
      creativity: '创造力',
      wisdom: '智慧',
      humor: '幽默'
    };

    const colors = {
      intelligence: '#4facfe',
      charisma: '#ff6b9d',
      creativity: '#c850c0',
      wisdom: '#ffd700',
      humor: '#ff9f43'
    };

    const attrsHtml = Object.entries(attributes).map(([key, value]) => `
      <div class="attribute-card">
        <div class="attribute-card__icon">${icons[key] || '⭐'}</div>
        <div class="attribute-card__label">${labels[key] || key}</div>
        <div class="attribute-card__value">${value}</div>
        <div class="attribute-card__bar">
          <div class="attribute-card__bar-fill" style="width: ${value}%; background: ${colors[key] || '#ffd700'}"></div>
        </div>
      </div>
    `).join('');

    return `<div class="attributes-grid">${attrsHtml}</div>`;
  }

  /**
   * Render info section
   */
  renderSection(title, content) {
    if (!content) return '';
    return `
      <div class="info-section">
        <h3 class="info-section__title">${title}</h3>
        <div class="info-section__content">${content}</div>
      </div>
    `;
  }

  /**
   * Render skills
   */
  renderSkills(skills) {
    const skillsHtml = skills.map(skill => `
      <div class="skill-item">
        <span class="skill-item__icon">⚡</span>
        <div class="skill-item__info">
          <div class="skill-item__name">${skill.name}</div>
          <div class="skill-item__desc">${skill.description || ''}</div>
        </div>
        <span class="skill-item__level">${skill.level || '-'}</span>
      </div>
    `).join('');

    return `
      <div class="info-section">
        <h3 class="info-section__title">⚡ 技能</h3>
        <div class="skills-grid">${skillsHtml}</div>
      </div>
    `;
  }

  /**
   * Render quotes
   */
  renderQuotes(quotes) {
    const quotesHtml = quotes.map(quote => `
      <div class="quote-card">
        <p class="quote-card__text">"${quote.text}"</p>
        ${quote.source ? `<span class="quote-card__source">— ${quote.source}</span>` : ''}
      </div>
    `).join('');

    return `
      <div class="info-section">
        <h3 class="info-section__title">💬 名言</h3>
        <div class="quotes-list">${quotesHtml}</div>
      </div>
    `;
  }

  /**
   * Render chat style
   */
  renderChatStyle(style) {
    const examples = style.examples?.map(ex => `
      <div class="chat-example">
        <span class="chat-example__role chat-example__role--user">用户</span>
        <p class="chat-example__text">${ex.user}</p>
        <span class="chat-example__role chat-example__role--ai">${store.get('currentPersona')?.name || 'AI'}</span>
        <p class="chat-example__text">${ex.ai}</p>
      </div>
    `).join('') || '';

    return `
      <div class="info-section">
        <h3 class="info-section__title">🗣️ 对话风格</h3>
        <div class="info-section__content">
          <p><strong>语气：</strong>${style.tone || '未指定'}</p>
          ${style.patterns?.length ? `<p><strong>说话模式：</strong>${style.patterns.join('、')}</p>` : ''}
          ${examples}
        </div>
      </div>
    `;
  }

  /**
   * Chat functions
   */
  startChat() {
    const persona = store.get('currentPersona');
    if (!persona) return;

    store.set('chatHistory', []);
    store.set('isChatOpen', true);
    
    if (this.elements.chatName) {
      this.elements.chatName.textContent = persona.name;
    }
    if (this.elements.chatAvatar) {
      this.elements.chatAvatar.textContent = persona.emoji || '🎭';
    }
    
    this.renderChatMessages();
  }

  toggleChat() {
    store.set('isChatOpen', !store.get('isChatOpen'));
  }

  async sendMessage() {
    const input = this.elements.chatInput;
    const message = input?.value.trim();
    if (!message) return;

    const persona = store.get('currentPersona');
    if (!persona) return;

    // Add user message
    const history = store.get('chatHistory');
    history.push({ user: message, ai: null });
    store.set('chatHistory', history);
    
    input.value = '';
    input.style.height = 'auto';
    this.renderChatMessages();

    // Show typing indicator
    this.showTypingIndicator();

    try {
      const response = await api.sendMessage(
        message,
        persona,
        history.slice(0, -1)
      );

      // Update with AI response
      history[history.length - 1].ai = response.content;
      store.set('chatHistory', history);
      
      this.hideTypingIndicator();
      this.renderChatMessages();
    } catch (error) {
      this.hideTypingIndicator();
      history[history.length - 1].ai = `[错误] ${error.message}`;
      store.set('chatHistory', history);
      this.renderChatMessages();
      this.showToast(error.message, 'error');
    }
  }

  renderChatMessages() {
    if (!this.elements.chatMessages) return;

    const history = store.get('chatHistory');
    const persona = store.get('currentPersona');

    const html = history.map((msg, i) => `
      <div class="chat-message chat-message--user">
        <div class="chat-message__avatar">👤</div>
        <div class="chat-message__content">
          <div class="chat-message__text">${this.escapeHtml(msg.user)}</div>
          <div class="chat-message__time">${this.formatTime()}</div>
        </div>
      </div>
      ${msg.ai ? `
        <div class="chat-message">
          <div class="chat-message__avatar">${persona?.emoji || '🎭'}</div>
          <div class="chat-message__content">
            <div class="chat-message__text">${this.formatMessage(msg.ai)}</div>
            <div class="chat-message__time">${this.formatTime()}</div>
          </div>
        </div>
      ` : ''}
    `).join('');

    this.elements.chatMessages.innerHTML = html;
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-message typing-indicator-container';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
      <div class="chat-message__avatar">${store.get('currentPersona')?.emoji || '🎭'}</div>
      <div class="chat-message__content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    this.elements.chatMessages?.appendChild(indicator);
    this.elements.chatMessages && (this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight);
  }

  hideTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
  }

  clearChat() {
    store.set('chatHistory', []);
    this.renderChatMessages();
  }

  exportChat() {
    const history = store.get('chatHistory');
    const persona = store.get('currentPersona');
    
    const content = history.map(h => 
      `用户：${h.user}\n${persona?.name}：${h.ai || '[无回复]'}`
    ).join('\n\n---\n\n');

    this.downloadFile(content, `chat-${persona?.name || 'export'}.txt`, 'text/plain');
  }

  /**
   * Modal functions
   */
  openModal(modalId) {
    store.set('activeModal', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('modal-overlay--visible');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal() {
    const activeModal = store.get('activeModal');
    if (activeModal) {
      document.getElementById(activeModal)?.classList.remove('modal-overlay--visible');
    }
    store.set('activeModal', null);
    document.body.style.overflow = '';
  }

  openSettings() {
    document.getElementById('apiKeyInput') && (document.getElementById('apiKeyInput').value = store.get('apiKey'));
    document.getElementById('apiProxyInput') && (document.getElementById('apiProxyInput').value = store.get('apiProxy'));
    document.getElementById('modelNameInput') && (document.getElementById('modelNameInput').value = store.get('modelName'));

    const provider = store.get('apiProvider') || 'minimax';
    this.updateProviderUI(provider);
    
    this.openModal('settingsModal');
  }

  updateProviderUI(provider) {
    const minimaxBtn = document.getElementById('providerMinimax');
    const deepseekBtn = document.getElementById('providerDeepseek');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const modelInput = document.getElementById('modelNameInput');
    const proxyHint = document.getElementById('proxyHint');

    if (provider === 'deepseek') {
      minimaxBtn?.classList.remove('chip--active');
      deepseekBtn?.classList.add('chip--active');
      if (apiKeyLabel) apiKeyLabel.textContent = 'DeepSeek API Key';
      if (modelInput) modelInput.placeholder = '默认: deepseek-chat';
      if (proxyHint) proxyHint.textContent = '留空使用 api.deepseek.com';
    } else {
      minimaxBtn?.classList.add('chip--active');
      deepseekBtn?.classList.remove('chip--active');
      if (apiKeyLabel) apiKeyLabel.textContent = 'MiniMax API Key';
      if (modelInput) modelInput.placeholder = '默认: MiniMax-M2.7';
      if (proxyHint) proxyHint.textContent = 'MiniMax 留空使用默认代理';
    }
  }

  setProvider(provider) {
    store.set('apiProvider', provider);
    this.updateProviderUI(provider);
  }

  saveSettings() {
    const apiKey = document.getElementById('apiKeyInput')?.value.trim();
    const proxy = document.getElementById('apiProxyInput')?.value.trim();
    const provider = store.get('apiProvider') || 'minimax';
    let model = document.getElementById('modelNameInput')?.value.trim();

    if (!model) {
      model = provider === 'deepseek' ? 'deepseek-chat' : 'MiniMax-M2.7';
    }

    store.set('apiKey', apiKey);
    store.set('apiProxy', proxy);
    store.set('modelName', model);

    this.closeModal();
    this.showToast('设置已保存', 'success');
  }

  async testApi() {
    try {
      await api.testConnection();
      this.showToast('API 连接成功！', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  openSaveModal() {
    const persona = store.get('currentPersona');
    if (!persona) return;

    document.getElementById('saveNameInput') && (document.getElementById('saveNameInput').value = persona.name);
    this.renderGroupSelector();
    this.openModal('saveModal');
  }

  renderGroupSelector() {
    const container = document.getElementById('groupSelector');
    if (!container) return;

    const groups = store.get('savedGroups');
    container.innerHTML = groups.map(g => `
      <button class="chip ${g === store.get('activeGroup') ? 'chip--active' : ''}" 
              onclick="ui.selectSaveGroup('${g}')">
        ${g}
      </button>
    `).join('');
  }

  selectSaveGroup(group) {
    store.set('activeGroup', group);
    this.renderGroupSelector();
  }

  createNewGroup() {
    const input = document.getElementById('newGroupInput');
    const name = input?.value.trim();
    if (!name) return;

    const groups = store.get('savedGroups');
    if (!groups.includes(name)) {
      groups.push(name);
      store.set('savedGroups', groups);
    }
    
    store.set('activeGroup', name);
    this.renderGroupSelector();
    if (input) input.value = '';
  }

  confirmSavePersona() {
    const persona = store.get('currentPersona');
    if (!persona) return;

    const saved = store.get('savedPersonas');
    const existingIndex = saved.findIndex(p => p.name === persona.name);
    
    const personaToSave = {
      ...persona,
      group: store.get('activeGroup') || '默认',
      savedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      saved[existingIndex] = personaToSave;
    } else {
      saved.push(personaToSave);
    }

    store.set('savedPersonas', saved);
    this.closeModal();
    this.showToast('人物已保存', 'success');
  }

  openDebateModal() {
    const persona = store.get('currentPersona');
    if (!persona) {
      this.showToast('请先生成或选择一个角色', 'warning');
      return;
    }

    store.set('debateParticipants', [{ ...persona, isBase: true }]);
    store.set('debateRounds', 1);
    
    this.renderDebateParticipants();
    this.openModal('debateModal');
  }

  renderDebateParticipants() {
    const container = document.getElementById('debateParticipantChips');
    if (!container) return;

    const participants = store.get('debateParticipants');
    container.innerHTML = participants.map((p, i) => `
      <div class="chip chip--removable ${p.isBase ? 'chip--active' : ''}">
        ${p.emoji} ${p.name}${p.isBase ? ' ★' : ''}
        ${!p.isBase ? `<button class="chip__remove" onclick="ui.removeDebateParticipant(${i})">×</button>` : ''}
      </div>
    `).join('');
  }

  removeDebateParticipant(index) {
    const participants = store.get('debateParticipants');
    if (participants[index]?.isBase) {
      this.showToast('基础角色不能移除', 'warning');
      return;
    }
    participants.splice(index, 1);
    store.set('debateParticipants', participants);
    this.renderDebateParticipants();
  }

  setDebateRounds(n) {
    store.set('debateRounds', n);
    document.querySelectorAll('[id^="round"][id$="Btn"]').forEach(btn => {
      btn.classList.remove('chip--active');
    });
    document.getElementById(`round${n}Btn`)?.classList.add('chip--active');
  }

  /**
   * Drawer functions
   */
  openDrawer(drawerId) {
    store.set('activeDrawer', drawerId);
    const drawer = document.getElementById(drawerId);
    if (drawer) {
      drawer.classList.add('drawer-overlay--visible');
      document.body.style.overflow = 'hidden';
    }
  }

  closeDrawer() {
    const activeDrawer = store.get('activeDrawer');
    if (activeDrawer) {
      document.getElementById(activeDrawer)?.classList.remove('drawer-overlay--visible');
    }
    store.set('activeDrawer', null);
    document.body.style.overflow = '';
  }

  openSavedDrawer() {
    store.set('activeGroup', '全部');
    this.renderSavedList();
    this.renderGroupTabs();
    this.openDrawer('savedDrawer');
  }

  renderGroupTabs() {
    const container = document.getElementById('groupTabs');
    if (!container) return;

    const groups = ['全部', ...store.get('savedGroups')];
    const active = store.get('activeGroup');

    container.innerHTML = groups.map(g => `
      <button class="chip ${g === active ? 'chip--active' : ''}" 
              onclick="ui.selectGroup('${g}')">
        ${g}
      </button>
    `).join('');
  }

  selectGroup(group) {
    store.set('activeGroup', group);
    this.renderGroupTabs();
    this.renderSavedList();
  }

  renderSavedList() {
    const container = document.getElementById('savedList');
    if (!container) return;

    const filtered = store.get('filteredPersonas');

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📚</div>
          <div class="empty-state__title">暂无保存的人物</div>
          <div class="empty-state__description">生成人物后点击"保存"按钮添加到收藏</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => `
      <div class="saved-item" onclick="ui.loadSavedPersona('${p.id}')">
        <span class="drag-handle">⋮⋮</span>
        <span class="emoji">${p.emoji}</span>
        <div class="info">
          <div class="name">${p.name}</div>
          <div class="date">${p.group || '默认'} · ${this.formatDate(p.savedAt)}</div>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation(); ui.deleteSavedPersona('${p.id}')">🗑️</button>
      </div>
    `).join('');
  }

  loadSavedPersona(id) {
    const saved = store.get('savedPersonas');
    const persona = saved.find(p => p.id === id);
    if (persona) {
      store.set('currentPersona', persona);
      this.closeDrawer();
      this.showToast(`已加载：${persona.name}`, 'success');
    }
  }

  deleteSavedPersona(id) {
    if (!confirm('确定要删除这个人物吗？')) return;

    const saved = store.get('savedPersonas');
    const index = saved.findIndex(p => p.id === id);
    if (index >= 0) {
      saved.splice(index, 1);
      store.set('savedPersonas', saved);
      this.renderSavedList();
      this.showToast('已删除', 'success');
    }
  }

  /**
   * Export/Import
   */
  exportPersona() {
    const persona = store.get('currentPersona');
    if (!persona) return;

    const data = JSON.stringify(persona, null, 2);
    this.downloadFile(data, `${persona.name}.json`, 'application/json');
  }

  importPersonaFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const persona = JSON.parse(e.target.result);
        store.set('currentPersona', persona);
        this.showToast('导入成功', 'success');
      } catch (error) {
        this.showToast('文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  }

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Toast notifications
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = this.elements.toastContainer || document.body;
    
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span>${this.getToastIcon(type)}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  getToastIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Utilities
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatMessage(text) {
    // Convert markdown-like formatting
    return this.escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  formatTime() {
    return new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

// Export
window.UIManager = UIManager;
window.ui = new UIManager();
