// Content script for Twitter Tabs Extension - Integrated with inject.js
console.log("🚀 Twitter Tabs Content Script loaded!");

class TwitterTabManager {
  constructor() {
    this.tabs = [];
    this.currentFilter = null;
    this.isRefreshing = false;
    this.init();
  }

  async init() {
    console.log('🎬 TwitterTabManager initializing...');
    
    await this.loadTabs();
    console.log('📚 Tabs loaded:', this.tabs);
    
    this.waitForTwitter(() => {
      console.log('✅ Twitter loaded, injecting UI...');
      this.injectDropdownMenu();
      this.setupMessageListener();
      this.setupNavigationWatcher();
    });
  }

  waitForTwitter(callback) {
    const checkInterval = setInterval(() => {
      const nav = document.querySelector('nav[role="navigation"]');
      const timeline = document.querySelector('[data-testid="primaryColumn"]');
      
      if (nav && timeline) {
        clearInterval(checkInterval);
        callback();
      }
    }, 100);
  }

  async loadTabs() {
    if (!this.isExtensionContextValid()) {
      console.warn("Extension context invalid, using default tabs");
      this.tabs = this.getDefaultTabs();
      return;
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['customTabs'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn("Extension context invalidated, using default tabs");
            this.tabs = this.getDefaultTabs();
            resolve();
            return;
          }
          
          this.tabs = result.customTabs || this.getDefaultTabs();
          resolve();
        });
      } catch (error) {
        console.warn("Failed to load tabs from storage:", error);
        this.tabs = this.getDefaultTabs();
        resolve();
      }
    });
  }

  getDefaultTabs() {
    return [
      { 
        id: 'basketball', 
        name: 'Basketball', 
        description: 'NBA, basketball games, players, teams, scores, highlights', 
        keywords: ['nba', 'basketball', 'lakers', 'lebron', 'curry', 'dunk', 'playoffs', 'warriors', 'celtics', 'nets', 'heat', 'bulls', 'knicks', 'spurs', 'mavs', 'bucks', 'suns', 'sixers', 'tatum', 'giannis', 'jokic', 'embiid', 'harden', 'durant', 'kawhi', 'dame', 'luka', 'booker']
      },
      { 
        id: 'politics', 
        name: 'Politics', 
        description: 'Political news, elections, government, policy discussions, congress, senate', 
        keywords: ['politics', 'election', 'president', 'congress', 'policy', 'vote', 'democrat', 'republican', 'senate', 'house', 'trump', 'biden', 'campaign']
      },
      { 
        id: 'religion', 
        name: 'Religion', 
        description: 'Religious discussions, faith, spirituality, theology, prayer, worship', 
        keywords: ['god', 'faith', 'church', 'prayer', 'bible', 'religious', 'spiritual', 'theology', 'jesus', 'christian', 'muslim', 'islam', 'worship']
      }
    ];
  }

  isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  injectDropdownMenu() {
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) return;

    if (document.querySelector('.twitter-filter-dropdown-container')) return;

    const isPostDetailPage = this.isOnPostDetailPage();

    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'twitter-filter-dropdown-container';
    dropdownContainer.innerHTML = `
      <div class="twitter-filter-dropdown">
        <button class="filter-dropdown-button ${isPostDetailPage ? 'disabled' : ''}" id="filter-dropdown-toggle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="filter-icon">
            ${isPostDetailPage 
              ? '<path d="M17 10c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1V7c0-2.76 2.24-5 5-5s5 2.24 5 5v3zm2 0v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-3.86-3.14-7-7-7S3 6.14 3 10v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-4.97 4.03-9 9-9s9 4.03 9 9zM8 15c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-5z"/>'
              : '<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"></path>'
            }
          </svg>
          <span class="filter-label">All Tweets</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="dropdown-arrow">
            <path d="M7 10l5 5 5-5z"></path>
          </svg>
        </button>
        <div class="filter-dropdown-menu" id="filter-dropdown-menu">
          <div class="filter-option" data-filter="all">
            <span>All Tweets</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
            </svg>
          </div>
          ${this.tabs.map(tab => `
            <div class="filter-option" data-filter="${tab.id}">
              <span>${tab.name}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon hidden">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
              </svg>
            </div>
          `).join('')}
          <div class="filter-divider"></div>
          <div class="filter-option add-filter" id="add-filter-option">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
            </svg>
            <span>Add New Filter</span>
          </div>
        </div>
      </div>
    `;

    primaryColumn.insertBefore(dropdownContainer, primaryColumn.firstChild);
    this.attachDropdownListeners();
    this.updateActiveFilter();
  }

  isOnPostDetailPage() {
    const url = window.location.pathname;
    
    // Allow filter only on home timeline (For You / Following)
    // Lock everywhere else
    const isHomePage = url === '/home' || url === '/';
    
    return !isHomePage;
  }

  attachDropdownListeners() {
    const toggleButton = document.getElementById('filter-dropdown-toggle');
    const menu = document.getElementById('filter-dropdown-menu');
    const filterOptions = document.querySelectorAll('.filter-option:not(.add-filter)');
    const addFilterOption = document.getElementById('add-filter-option');

    toggleButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!toggleButton.classList.contains('disabled')) {
        menu.classList.toggle('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.twitter-filter-dropdown')) {
        menu?.classList.remove('show');
      }
    });

    filterOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const filterId = option.dataset.filter;
        this.setFilter(filterId === 'all' ? null : filterId);
        menu.classList.remove('show');
      });
    });

    addFilterOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.remove('show');
      this.showAddTabDialog();
    });
  }

  setFilter(filterId) {
    console.log('🎯 Setting filter to:', filterId);
    
    // Don't allow filter changes on non-home pages
    if (this.isOnPostDetailPage()) {
      console.log('⚠️ Filter cannot be changed on this page');
      return;
    }
    
    // Prevent multiple simultaneous refreshes
    if (this.isRefreshing) {
      console.log('⏸️ Already refreshing, ignoring filter change');
      return;
    }
    
    this.currentFilter = filterId;
    this.updateActiveFilter();
    
    // Send filter to inject.js (page context)
    const filterConfig = filterId ? this.tabs.find(t => t.id === filterId) : null;
    
    console.log('🔍 Looking for filter:', filterId);
    console.log('📚 Available tabs:', this.tabs.map(t => t.id));
    console.log('✅ Found config:', filterConfig);
    
    window.postMessage({
      type: 'SET_FILTER',
      filter: filterId,
      config: filterConfig
    }, '*');
    
    console.log('📤 Sent filter to inject.js:', filterId, filterConfig);
    
    // Auto-refresh the page to apply filter
    this.refreshPage();
  }

  refreshPage() {
    console.log('🔄 Refreshing page to apply filter...');
    this.isRefreshing = true;
    
    // Show loading indicator
    this.showRefreshingIndicator();
    
    // Save current filter to storage before refresh
    if (this.isExtensionContextValid()) {
      chrome.storage.local.set({ 
        lastFilter: this.currentFilter,
        lastFilterTimestamp: Date.now()
      }, () => {
        setTimeout(() => {
          window.location.reload();
        }, 300);
      });
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  showRefreshingIndicator() {
    const button = document.getElementById('filter-dropdown-toggle');
    if (!button) return;
    
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
    
    const label = button.querySelector('.filter-label');
    if (label) {
      label.textContent = 'Refreshing...';
    }
  }

  async restoreFilterAfterRefresh() {
    if (!this.isExtensionContextValid()) return;

    return new Promise((resolve) => {
      chrome.storage.local.get(['lastFilter', 'lastFilterTimestamp'], (result) => {
        if (chrome.runtime.lastError) {
          resolve();
          return;
        }

        const timestamp = result.lastFilterTimestamp || 0;
        const age = Date.now() - timestamp;
        
        if (age < 5000 && result.lastFilter) {
          console.log('🔄 Restoring filter after refresh:', result.lastFilter);
          this.currentFilter = result.lastFilter;
          
          const filterConfig = this.tabs.find(t => t.id === result.lastFilter);
          window.postMessage({
            type: 'SET_FILTER',
            filter: result.lastFilter,
            config: filterConfig
          }, '*');
          
          this.updateActiveFilter();
          
          chrome.storage.local.remove(['lastFilter', 'lastFilterTimestamp']);
        }
        
        resolve();
      });
    });
  }

  updateActiveFilter() {
    const filterLabel = document.querySelector('.filter-label');
    const checkIcons = document.querySelectorAll('.check-icon');
    
    checkIcons.forEach(icon => icon.classList.add('hidden'));

    if (!this.currentFilter) {
      if (filterLabel) filterLabel.textContent = 'All Tweets';
      const allOption = document.querySelector('[data-filter="all"] .check-icon');
      allOption?.classList.remove('hidden');
    } else {
      const selectedTab = this.tabs.find(t => t.id === this.currentFilter);
      if (filterLabel && selectedTab) {
        filterLabel.textContent = selectedTab.name;
      }
      const selectedOption = document.querySelector(`[data-filter="${this.currentFilter}"] .check-icon`);
      selectedOption?.classList.remove('hidden');
    }
  }

  showAddTabDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'custom-tab-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Add New Topic Filter</h3>
        <input type="text" id="tab-name" placeholder="Filter name (e.g., 'Tech News')" />
        <textarea id="tab-description" placeholder="Describe what content should appear (e.g., 'Technology news, AI, startups, programming')" rows="4"></textarea>
        <input type="text" id="tab-keywords" placeholder="Keywords (comma-separated, e.g., 'AI, tech, coding, startup')" />
        <div class="dialog-buttons">
          <button id="cancel-tab">Cancel</button>
          <button id="save-tab">Add Filter</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('save-tab').addEventListener('click', () => {
      this.addNewTab();
      document.body.removeChild(dialog);
    });

    document.getElementById('cancel-tab').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }

  async addNewTab() {
    const name = document.getElementById('tab-name').value.trim();
    const description = document.getElementById('tab-description').value.trim();
    const keywordsInput = document.getElementById('tab-keywords').value.trim();

    if (!name || !description || !keywordsInput) {
      alert('Please fill in all fields');
      return;
    }

    const keywords = keywordsInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k);

    const newTab = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      keywords
    };

    this.tabs.push(newTab);
    await this.saveTabs();
    this.updateDropdownMenu();
    
    console.log('✅ New filter added:', newTab);
  }

  async saveTabs() {
    if (!this.isExtensionContextValid()) {
      console.warn("Extension context invalid, cannot save tabs");
      return;
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ customTabs: this.tabs }, () => {
          if (chrome.runtime.lastError) {
            console.warn("Failed to save tabs:", chrome.runtime.lastError);
          } else {
            console.log('💾 Tabs saved to storage');
          }
          resolve();
        });
      } catch (error) {
        console.warn("Failed to save tabs:", error);
        resolve();
      }
    });
  }

  updateDropdownMenu() {
    const menu = document.getElementById('filter-dropdown-menu');
    if (!menu) return;

    menu.innerHTML = `
      <div class="filter-option" data-filter="all">
        <span>All Tweets</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon ${!this.currentFilter ? '' : 'hidden'}">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
        </svg>
      </div>
      ${this.tabs.map(tab => `
        <div class="filter-option" data-filter="${tab.id}">
          <span>${tab.name}</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon ${this.currentFilter === tab.id ? '' : 'hidden'}">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
          </svg>
        </div>
      `).join('')}
      <div class="filter-divider"></div>
      <div class="filter-option add-filter" id="add-filter-option">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
        </svg>
        <span>Add New Filter</span>
      </div>
    `;

    this.attachDropdownListeners();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateTabs') {
        this.loadTabs().then(() => {
          this.updateDropdownMenu();
        });
      }
    });
  }

  setupNavigationWatcher() {
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.updateDropdownState();
        this.reinitialize();
      }
    });
    
    urlObserver.observe(document, { subtree: true, childList: true });

    window.addEventListener('popstate', () => {
      this.updateDropdownState();
      this.reinitialize();
    });

    const dropdownObserver = new MutationObserver(() => {
      if (!document.querySelector('.twitter-filter-dropdown-container')) {
        const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
        if (primaryColumn) {
          console.log('🔧 Dropdown removed, re-injecting...');
          this.injectDropdownMenu();
        }
      }
    });

    dropdownObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.urlObserver = urlObserver;
    this.dropdownObserver = dropdownObserver;
  }

  updateDropdownState() {
    const toggleButton = document.getElementById('filter-dropdown-toggle');
    const filterIcon = document.querySelector('.filter-icon');
    
    if (!toggleButton || !filterIcon) return;

    const isPostDetailPage = this.isOnPostDetailPage();
    
    if (isPostDetailPage) {
      toggleButton.classList.add('disabled');
      filterIcon.innerHTML = '<path d="M17 10c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1V7c0-2.76 2.24-5 5-5s5 2.24 5 5v3zm2 0v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-3.86-3.14-7-7-7S3 6.14 3 10v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-4.97 4.03-9 9-9s9 4.03 9 9zM8 15c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-5z"/>';
    } else {
      toggleButton.classList.remove('disabled');
      filterIcon.innerHTML = '<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"></path>';
    }
  }

  reinitialize() {
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) return;

    const existingDropdown = document.querySelector('.twitter-filter-dropdown-container');
    if (!existingDropdown) {
      this.injectDropdownMenu();
    }
  }
}

console.log('✅ Initializing TwitterTabManager...');
const tabManager = new TwitterTabManager();

setTimeout(() => {
  tabManager.restoreFilterAfterRefresh();
}, 500);