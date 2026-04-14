/**
 * CharRole API Module
 * Handles all API interactions with MiniMax and DeepSeek
 */

class APIClient {
  constructor() {
    this.retryAttempts = 1;
    this.retryDelay = 1000;
    this.defaultApiKey = 'sk-cp-XcP47OfWuVXPhIg0hX7GSRAbOyjolof68-AfBoM56SOHAzG_sb8V8lRQ2RYYIU4nf_SIjeQkvO7j8UxhG6-pZv5SFElH0o4bysNVtIrXz5HzrHEnqSdyGl0';
  }

  get apiKey() {
    return store.get('apiKey') || this.defaultApiKey;
  }

  get provider() {
    return store.get('apiProvider') || 'minimax';
  }

  get baseURL() {
    if (this.provider === 'deepseek') {
      return store.get('apiProxy') || 'https://api.deepseek.com';
    }
    return '/minimax-api/anthropic';
  }

  get proxy() {
    return this.baseURL;
  }

  get model() {
    if (this.provider === 'deepseek') {
      return store.get('modelName') || 'deepseek-chat';
    }
    return store.get('modelName') || 'MiniMax-M2.7';
  }

  /**
   * Test API connection
   */
  async testConnection() {
    if (!this.apiKey) {
      throw new Error('API Key 未配置');
    }

    try {
      if (this.provider === 'deepseek') {
        const response = await fetch(`${this.proxy}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
      } else {
        const response = await fetch(`${this.proxy}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
            max_tokens: 10
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
      }

      store.set('apiStatus', 'ok');
      return { success: true, message: '连接成功' };
    } catch (error) {
      store.set('apiStatus', 'error');
      throw new Error(`连接失败: ${error.message}`);
    }
  }

  /**
   * Generate persona from name/title
   */
  async generatePersona(name) {
    if (!this.apiKey) {
      throw new Error('请先配置 API Key');
    }

    store.set('isGenerating', true);
    store.set('generationProgress', '正在分析人物信息...');

    const prompt = `请为"${name}"创建一个详细的AI角色设定。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "name": "人物名称",
  "emoji": "代表emoji",
  "title": "头衔/身份",
  "description": "详细描述",
  "personality": "性格特点",
  "background": "背景故事",
  "attributes": {
    "intelligence": 1-100,
    "charisma": 1-100,
    "creativity": 1-100,
    "wisdom": 1-100,
    "humor": 1-100
  },
  "skills": [
    {"name": "技能名", "description": "技能描述", "level": 1-10}
  ],
  "quotes": [
    {"text": "名言", "source": "出处"}
  ],
  "chatStyle": {
    "tone": "语气特点",
    "patterns": ["说话模式1", "说话模式2"],
    "examples": [
      {"user": "用户问题", "ai": "AI回复"}
    ]
  }
}`;

    try {
      const providerName = this.provider === 'deepseek' ? 'DeepSeek' : 'MiniMax';
      store.set('generationProgress', `正在调用 ${providerName} API...`);
      
      const response = await this.chatCompletion([
        { role: 'system', content: '你是一个专业的角色设定生成器。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.8, maxTokens: 3000 });

      store.set('generationProgress', '正在解析结果...');
      
      // Extract JSON from response
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('无法解析返回的数据');
      }

      const persona = JSON.parse(jsonMatch[0]);
      
      // Add metadata
      persona.id = this.generateId();
      persona.createdAt = new Date().toISOString();
      persona.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(persona.name)}&backgroundColor=b6e3f4`;
      
      store.set('currentPersona', persona);
      store.set('apiStatus', 'ok');
      
      return persona;
    } catch (error) {
      store.set('apiStatus', 'error');
      throw error;
    } finally {
      store.set('isGenerating', false);
      store.set('generationProgress', '');
    }
  }

  /**
   * Send chat message
   */
  async sendMessage(message, persona, history = []) {
    if (!this.apiKey) {
      throw new Error('API Key 未配置');
    }

    const settings = store.get('chatSettings');
    
    let systemPrompt = `你是${persona.name}`;
    if (persona.title) systemPrompt += `（${persona.title}）`;
    if (persona.description) systemPrompt += `。${persona.description}`;
    if (persona.personality) systemPrompt += `你的性格特点是：${persona.personality}`;
    if (persona.chatStyle?.tone) systemPrompt += `你的语气风格是：${persona.chatStyle.tone}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => [
        { role: 'user', content: h.user },
        { role: 'assistant', content: h.ai }
      ]).flat(),
      { role: 'user', content: message }
    ];

    return this.chatCompletion(messages, {
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    });
  }

  /**
   * Generate debate message
   */
  async generateDebateMessage(persona, topic, round, previousMessages = []) {
    if (!this.apiKey) {
      return `[离线模式] ${persona.name} 认为：这个问题值得深入思考...`;
    }

    let context = `你是${persona.name}`;
    if (persona.title) context += `（${persona.title}）`;
    if (persona.description) context += `。${persona.description}`;
    if (persona.personality) context += `性格特点：${persona.personality}`;
    
    context += `\n\n当前论道主题：「${topic}」`;
    
    if (round > 1 && previousMessages.length > 0) {
      context += '\n\n前面已经发表的观点：\n';
      previousMessages.forEach(m => {
        context += `- ${m.persona.name}：${m.text}\n`;
      });
      context += '\n请从你的角度，对上述观点发表新的看法或进行辩论。';
    } else {
      context += '\n\n请从你的角度，发表对这个主题的看法。';
    }

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: context },
        { role: 'user', content: '请发表你的观点。' }
      ], { temperature: 0.8, maxTokens: 1500 });

      return response.content;
    } catch (error) {
      console.error('Debate message error:', error);
      return `${persona.name} 表示：这个问题需要更多思考...`;
    }
  }

  /**
   * Generate debate summary
   */
  async generateDebateSummary(topic, messages) {
    if (!this.apiKey) {
      return '离线模式：无法生成总结';
    }

    const context = messages.map(m => 
      `${m.persona.name}（第${m.round}轮）：${m.text}`
    ).join('\n\n');

    const prompt = `请对以下关于「${topic}」的论道进行总结：

${context}

请从以下几个方面总结：
1. 各方核心观点
2. 共识与分歧
3. 最有价值的见解
4. 可以进一步探讨的问题`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: '你是一个专业的辩论总结者。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.7, maxTokens: 2000 });

      return response.content;
    } catch (error) {
      console.error('Summary error:', error);
      return '总结生成失败';
    }
  }

  /**
   * Base chat completion method with retry
   */
  async chatCompletion(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 2000 } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        if (this.provider === 'deepseek') {
          const response = await fetch(`${this.proxy}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model: this.model,
              messages: messages.map(msg => {
                if (Array.isArray(msg.content)) {
                  return {
                    ...msg,
                    content: msg.content.find(c => c.type === 'text')?.text || ''
                  };
                }
                return msg;
              }),
              temperature,
              max_tokens: maxTokens
            })
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }

          const result = await response.json();
          const content = result.choices?.[0]?.message?.content || '';
          return { content: content.trim(), raw: result };
        } else {
          const formattedMessages = messages.map(msg => {
            if (typeof msg.content === 'string') {
              return {
                ...msg,
                content: [{ type: 'text', text: msg.content }]
              };
            }
            return msg;
          });

          const response = await fetch(`${this.proxy}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: this.model,
              messages: formattedMessages,
              temperature,
              max_tokens: maxTokens
            })
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }

          const result = await response.json();
          
          let content = '';
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text');
            content = textContent?.text || '';
          } else if (typeof result.content === 'string') {
            content = result.content;
          } else if (result.choices && result.choices[0]) {
            content = result.choices[0].message?.content || result.choices[0].text || '';
          }

          return { content: content.trim(), raw: result };
        }
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export
window.APIClient = APIClient;
window.api = new APIClient();
