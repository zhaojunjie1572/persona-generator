/**
 * CharRole State Management
 * Centralized state store with reactive updates
 */

class Store {
  constructor(initialState = {}) {
    this.state = new Proxy(initialState, {
      set: (target, key, value) => {
        const oldValue = target[key];
        target[key] = value;
        this.notify(key, value, oldValue);
        return true;
      }
    });
    this.listeners = new Map();
    this.computed = new Map();
  }

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  // Notify listeners of state change
  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        callback(newValue, oldValue, key);
      });
    }
    
    // Notify computed properties that depend on this key
    this.computed.forEach((deps, computedKey) => {
      if (deps.has(key)) {
        this.notify(computedKey, this.getComputed(computedKey), null);
      }
    });
  }

  // Get state value
  get(key) {
    return key ? this.state[key] : this.state;
  }

  // Set state value
  set(key, value) {
    if (typeof key === 'object') {
      Object.assign(this.state, key);
    } else {
      this.state[key] = value;
    }
  }

  // Define computed property
  defineComputed(key, deps, computeFn) {
    this.computed.set(key, new Set(deps));
    this[`_${key}Fn`] = computeFn;
  }

  // Get computed value
  getComputed(key) {
    if (this[`_${key}Fn`]) {
      const deps = this.computed.get(key);
      const values = Array.from(deps).map(dep => this.state[dep]);
      return this[`_${key}Fn`](...values);
    }
    return undefined;
  }

  // Batch multiple updates
  batch(updates) {
    const previousState = { ...this.state };
    Object.assign(this.state, updates);
    Object.keys(updates).forEach(key => {
      this.notify(key, this.state[key], previousState[key]);
    });
  }
}

// Create global store instance
const store = new Store({
  // API Settings
  apiKey: localStorage.getItem('charrole_api_key') || '',
  apiProxy: localStorage.getItem('charrole_api_proxy') || '',
  modelName: localStorage.getItem('charrole_model') || 'MiniMax-M2.7',
  apiStatus: 'none', // 'none' | 'ok' | 'error'
  
  // Current Persona
  currentPersona: null,
  isGenerating: false,
  generationProgress: '',
  
  // Chat State
  chatHistory: [],
  isChatOpen: false,
  chatSettings: {
    temperature: 0.7,
    maxTokens: 4096
  },
  
  // Saved Personas
  savedPersonas: JSON.parse(localStorage.getItem('charrole_saved') || '[]'),
  savedGroups: JSON.parse(localStorage.getItem('charrole_groups') || '["默认"]'),
  activeGroup: '全部',
  
  // Debate State
  debateParticipants: [],
  debateRounds: 1,
  debateCurrentRound: 0,
  debateTopic: '',
  debateMessages: [],
  isDebateActive: false,
  
  // UI State
  activeModal: null,
  activeDrawer: null,
  toastQueue: []
});

// Define computed properties
store.defineComputed('savedCount', ['savedPersonas'], (personas) => personas.length);
store.defineComputed('hasCurrentPersona', ['currentPersona'], (persona) => !!persona);
store.defineComputed('isApiConfigured', ['apiKey'], (key) => !!key);
store.defineComputed('filteredPersonas', ['savedPersonas', 'activeGroup'], (personas, group) => {
  return group === '全部' ? personas : personas.filter(p => p.group === group);
});

// Persist settings to localStorage
store.subscribe('apiKey', (value) => {
  if (value) localStorage.setItem('charrole_api_key', value);
  else localStorage.removeItem('charrole_api_key');
});

store.subscribe('apiProxy', (value) => {
  if (value) localStorage.setItem('charrole_api_proxy', value);
  else localStorage.removeItem('charrole_api_proxy');
});

store.subscribe('modelName', (value) => {
  localStorage.setItem('charrole_model', value);
});

store.subscribe('savedPersonas', (value) => {
  localStorage.setItem('charrole_saved', JSON.stringify(value));
});

store.subscribe('savedGroups', (value) => {
  localStorage.setItem('charrole_groups', JSON.stringify(value));
});

// Export for use in other modules
window.Store = Store;
window.store = store;
