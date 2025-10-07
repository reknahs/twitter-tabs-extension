// content script for Twitter Tabs Extension

console.log("Content script loaded on Twitter!");

class TwitterTabManager {
  constructor() {
    this.tabs = [];
    this.currentFilter = null; // null means no filter (show all)
    this.hiddenTweets = new Set();
    this.observer = null;
    this.aiWorker = new AIContentAnalyzer();
    this.init();
  }

  async init() {
    // Load saved tabs from storage
    await this.loadTabs();
    
    // Wait for Twitter to load
    this.waitForTwitter(() => {
      this.injectDropdownMenu();
      this.setupMutationObserver();
      this.setupMessageListener();
    });
  }

  // wait for twitter page to load in 
  waitForTwitter(callback) {
    const checkInterval = setInterval(() => {
      const nav = document.querySelector('nav[role="navigation"]');
      const timeline = document.querySelector('[data-testid="primaryColumn"]');
      
      if (nav && timeline) {
        clearInterval(checkInterval);
        callback();
      }
    }, 500);
  }

  // gets previous tabs that were added by the user 
  async loadTabs() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['customTabs'], (result) => {
        this.tabs = result.customTabs || [
          { id: 'basketball', name: 'Basketball', description: 'NBA, basketball games, players, teams, scores, highlights', keywords: ['nba', 'basketball', 'lakers', 'lebron', 'curry', 'dunk', 'playoffs'] },
          { id: 'politics', name: 'Politics', description: 'Political news, elections, government, policy discussions', keywords: ['politics', 'election', 'president', 'congress', 'policy', 'vote', 'democrat', 'republican'] },
          { id: 'religion', name: 'Religion', description: 'Religious discussions, faith, spirituality, theology', keywords: ['god', 'faith', 'church', 'prayer', 'bible', 'religious', 'spiritual', 'theology'] }
        ];
        resolve();
      });
    });
  }

  // Inject dropdown menu instead of tabs
  injectDropdownMenu() {
    // Find the timeline header
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) return;

    // Check if dropdown already exists
    if (document.querySelector('.twitter-filter-dropdown-container')) return;

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'twitter-filter-dropdown-container';
    dropdownContainer.innerHTML = `
      <div class="twitter-filter-dropdown">
        <button class="filter-dropdown-button" id="filter-dropdown-toggle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"></path>
          </svg>
          <span class="filter-label">All Tweets</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="dropdown-arrow">
            <path d="M7 10l5 5 5-5z"></path>
          </svg>
        </button>
        <div class="filter-dropdown-menu" id="filter-dropdown-menu">
          <div class="filter-option" data-filter="all">
            <span>All Tweets</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon hidden">
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

    // Insert at the top of the primary column
    primaryColumn.insertBefore(dropdownContainer, primaryColumn.firstChild);

    // Add event listeners
    this.attachDropdownListeners();
    this.updateActiveFilter();
  }

  attachDropdownListeners() {
    const toggleButton = document.getElementById('filter-dropdown-toggle');
    const menu = document.getElementById('filter-dropdown-menu');
    const filterOptions = document.querySelectorAll('.filter-option:not(.add-filter)');
    const addFilterOption = document.getElementById('add-filter-option');

    // Toggle dropdown
    toggleButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.twitter-filter-dropdown')) {
        menu?.classList.remove('show');
      }
    });

    // Filter selection
    filterOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const filterId = option.dataset.filter;
        this.setFilter(filterId === 'all' ? null : filterId);
        menu.classList.remove('show');
      });
    });

    // Add new filter
    addFilterOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.remove('show');
      this.showAddTabDialog();
    });
  }

  setFilter(filterId) {
    this.currentFilter = filterId;
    this.updateActiveFilter();
    this.filterTimeline();
  }

  updateActiveFilter() {
    const filterLabel = document.querySelector('.filter-label');
    const checkIcons = document.querySelectorAll('.check-icon');
    
    // Hide all check icons
    checkIcons.forEach(icon => icon.classList.add('hidden'));

    if (!this.currentFilter) {
      // Show "All Tweets"
      if (filterLabel) filterLabel.textContent = 'All Tweets';
      const allOption = document.querySelector('[data-filter="all"] .check-icon');
      allOption?.classList.remove('hidden');
    } else {
      // Show selected filter
      const selectedTab = this.tabs.find(t => t.id === this.currentFilter);
      if (filterLabel && selectedTab) {
        filterLabel.textContent = selectedTab.name;
      }
      const selectedOption = document.querySelector(`[data-filter="${this.currentFilter}"] .check-icon`);
      selectedOption?.classList.remove('hidden');
    }
  }

  // Filter timeline based on current filter
  async filterTimeline() {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    
    if (!this.currentFilter) {
      // Show all tweets when no filter is active
      tweets.forEach(tweet => {
        tweet.style.display = '';
        tweet.closest('article')?.parentElement?.style.removeProperty('display');
      });
      return;
    }

    const currentTabConfig = this.tabs.find(t => t.id === this.currentFilter);
    if (!currentTabConfig) return;

    // Filter tweets based on current filter
    for (const tweet of tweets) {
      const tweetText = this.extractTweetText(tweet);
      const shouldShow = await this.aiWorker.analyzeTweet(tweetText, currentTabConfig);
      
      const tweetContainer = tweet.closest('article')?.parentElement;
      if (tweetContainer) {
        tweetContainer.style.display = shouldShow ? '' : 'none';
      }
    }
  }

  // extracts text of tweet 
  extractTweetText(tweetElement) {
    const textElements = tweetElement.querySelectorAll('[data-testid="tweetText"]');
    let text = '';
    textElements.forEach(el => {
      text += el.textContent + ' ';
    });
    
    // Also get username and any quoted tweet text
    const username = tweetElement.querySelector('[data-testid="User-Name"]')?.textContent || '';
    
    return (username + ' ' + text).toLowerCase();
  }

  // for when new tweets generated by the algorithm show up on the timeline 
  setupMutationObserver() {
    const timeline = document.querySelector('[data-testid="primaryColumn"]');
    if (!timeline) return;

    this.observer = new MutationObserver((mutations) => {
      // Debounce filtering to avoid performance issues
      clearTimeout(this.filterTimeout);
      this.filterTimeout = setTimeout(() => {
        this.filterTimeline();
      }, 500);
    });

    this.observer.observe(timeline, {
      childList: true,
      subtree: true
    });
  }

  showAddTabDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'custom-tab-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Add New Topic Filter</h3>
        <input type="text" id="tab-name" placeholder="Filter name (e.g., 'Tech News')" />
        <textarea id="tab-description" placeholder="Describe what content should appear in this filter (e.g., 'Technology news, AI, startups, programming, software development')" rows="4"></textarea>
        <input type="text" id="tab-keywords" placeholder="Keywords (comma-separated, e.g., 'AI, tech, coding')" />
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
    const name = document.getElementById('tab-name').value;
    const description = document.getElementById('tab-description').value;
    const keywords = document.getElementById('tab-keywords').value.split(',').map(k => k.trim());

    if (!name || !description) return;

    const newTab = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      keywords
    };

    this.tabs.push(newTab);
    await this.saveTabs();
    this.updateDropdownMenu();
  }

  async saveTabs() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ customTabs: this.tabs }, resolve);
    });
  }

  updateDropdownMenu() {
    const menu = document.getElementById('filter-dropdown-menu');
    if (!menu) return;

    // Rebuild the menu
    menu.innerHTML = `
      <div class="filter-option" data-filter="all">
        <span>All Tweets</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon hidden">
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
    `;

    this.attachDropdownListeners();
    this.updateActiveFilter();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateTabs') {
        this.loadTabs().then(() => {
          this.updateDropdownMenu();
          this.filterTimeline();
        });
      }
    });
  }
}

// AI Content Analyzer using keyword matching and heuristics
class AIContentAnalyzer {
  async analyzeTweet(tweetText, tabConfig) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "analyzeWithAI",
          text: tweetText,
          tabConfig: tabConfig
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message error:", chrome.runtime.lastError);
            resolve(true); // default to show tweet if background fails
          } else {
            resolve(response.shouldShow);
          }
        }
      );
    });
  }
}

// Initialize the extension
const tabManager = new TwitterTabManager();