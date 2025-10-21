// AI KEYWORD GENERATOR
class KeywordGenerator {
  constructor() {
    // cached info 
    this.cache = new Map();
    // usable apis 
    this.apis = [
      {
        name: "Groq",
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: "llama-3.3-70b-versatile",
        keyName: "GROQ_API_KEY",
        type: "openai",
      },
      {
        name: "OpenAI",
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o-mini",
        keyName: "OPENAI_API_KEY",
        type: "openai",
      },
    ];
  }

  // generates keywords for certain topic 
  async generateKeywords(topicName, topicDescription, existingKeywords = []) {
    const cacheKey = `${topicName}-${topicDescription}`;

    // if this topic's keywords have already been cached, return them 
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // try each API in order
    for (const api of this.apis) {
      const apiKey = await this.getApiKey(api.keyName);

      // if api key has been inputted, use this api, if not move on to the next one
      if (!apiKey) {
        continue;
      }

      // try to call AI to generate keywords
      try {
        const keywords = await this.generateWithAI(
          api,
          apiKey,
          topicName,
          topicDescription
        );

        // if it generates over 50 keywords, cache them and use in the future 
        if (keywords.length >= 50) {
          this.cache.set(cacheKey, keywords);
          return keywords;
        }
      } catch (error) {
        console.error(`${api.name} failed:`, error.message);
        continue;
      }
    }

    // if all APIs, fail use local generation
    const keywords = this.generateKeywordsLocally(
      topicName,
      topicDescription,
      existingKeywords
    );
    this.cache.set(cacheKey, keywords);
    return keywords;
  }

  // gets API key from Chrome storage
  async getApiKey(keyName) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([keyName], (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result[keyName] || null);
        });
      } catch (error) {
        // if API key not found in storage, return null
        resolve(null);
      }
    });
  }

  // calls AI API to generate keyworeds
  async generateWithAI(api, apiKey, topicName, topicDescription) {
    // good prompt for this task (includes example)
    const prompt = `Generate exactly 50 of the BEST single-word keywords for filtering Twitter/X content about: "${topicName}"

Description: ${topicDescription}

CRITICAL REQUIREMENTS:
1. ONLY single words (one word per keyword)
2. NO multi-word phrases
3. NO hashtags (no # symbol)
4. NO underscores or hyphens
5. Choose ONLY the 50 most distinctive and commonly-used words

Include diverse but highly relevant categories:
- Core terminology that's unique to this topic 
- Most common slang and abbreviations 
- Essential technical terms
- Related subtopics and adjacent interests

For example, if the topic is "basketball":
GOOD: Lakers, Warriors, LeBron, Curry, Giannis, dunk, rebound, assist, buzzer, playoff, MVP, hoops, buckets, crossover, fadeaway, NBA, NCAA, shooting, blocking, championship, finals, allstar, draft, trade, injury, clutch, jersey, arena, coach, timeout, foul
BAD: sport, game, playing, people, fan, exciting, watching, love, today, great

Focus on words that are:
- Highly specific to this topic
- Frequently used in tweets about this topic
- Distinctive enough to filter effectively
- Not generic words that could apply to many topics

Return ONLY a comma-separated list of exactly 50 single words. No explanations, categories, numbering, or extra text.

Keywords:`;

    // sends POST request with prompt 
    const response = await fetch(api.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: api.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at understanding how people discuss topics on social media. Generate diverse, realistic keywords that cover all aspects of a topic.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    // error if it doesn't work 
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    // return generated keywords
    const result = await response.json();
    const generatedText = result.choices?.[0]?.message?.content || "";
    return this.parseKeywords(generatedText);
  }

  // cleans up AI response to get only the keywords
  parseKeywords(text) {
    // remove markdown formatting, bullet points, numbers
    let cleanText = text
      .replace(/```[\s\S]*?```/g, "") // remove code blocks
      .replace(/`([^`]+)`/g, "$1") // remove inline code
      .replace(/^\s*[-*•]\s+/gm, "") // remove bullet points
      .replace(/^\s*\d+\.\s+/gm, "") // remove numbered lists
      .replace(/\*\*([^*]+)\*\*/g, "$1") // remove bold
      .replace(/\n+/g, ", "); // replace newlines with commas

    // split by commas and clean up
    const keywords = cleanText
      .split(/[,\n]+/)
      .map((kw) => kw.trim().toLowerCase())
      .filter((kw) => kw.length > 0)
      .filter((kw) => kw.length < 50)
      .filter((kw) => !kw.includes(":")) // remove category labels
      .filter((kw) => !/^(keywords?|here|are|the|list):?$/i.test(kw)); // remove filler words from AI 

    // remove duplicates
    return [...new Set(keywords)];
  }

  // fallback when AI APIs aren't available for some reason 
  generateKeywordsLocally(topicName, topicDescription, existingKeywords) {
    const keywords = [...existingKeywords];
    const topic = topicName.toLowerCase();
    const desc = topicDescription.toLowerCase();

    // extract all words from topic name and description
    const allWords = [...topic.split(/\s+/), ...desc.split(/[\s,]+/)].filter(
      (w) => w.length > 2
    );

    // generate variations for each word
    allWords.forEach((word) => {
      const cleanWord = word.replace(/[^\w]/g, "");
      if (cleanWord.length < 2) return;

      keywords.push(cleanWord);
      keywords.push(cleanWord + "s");
      keywords.push(cleanWord + "ing");
      keywords.push(cleanWord + "ed");
      keywords.push(cleanWord + "er");
      keywords.push(cleanWord + "ers");
      keywords.push("#" + cleanWord);

      if (cleanWord.length > 4) {
        keywords.push(cleanWord.slice(0, -1));
      }
    });

    // multiword combinations
    const topicWords = topic.split(/\s+/).filter((w) => w.length > 2);
    if (topicWords.length > 1) {
      keywords.push(topicWords.join(""));
      keywords.push("#" + topicWords.join(""));

      for (let i = 0; i < topicWords.length - 1; i++) {
        keywords.push(topicWords[i] + topicWords[i + 1]);
        keywords.push(topicWords[i] + " " + topicWords[i + 1]);
      }
    }

    return [...new Set(keywords)]
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 1 && k.length < 50)
      .slice(0, 1000);
  }
}

// TAB MANAGER
class TwitterTabManager {
  constructor() {
    this.tabs = []; // all user-created filters 
    this.currentFilter = null; // current filter (null if all tweets)
    this.isRefreshing = false; // stop simultaneous page refreshes
    this.keywordGenerator = new KeywordGenerator(); 
    this.initializationComplete = false; // to see if initial setup is done
    this.init();
  }

  async init() {
    await this.loadTabs(); // load all tabs from storage
    await this.ensureAllKeywordsGenerated(); // generate keywords for any tabs without them yet
    this.initializationComplete = true;

    this.waitForTwitter(() => {
      this.injectDropdownMenu(); // dropdown UI 
      this.setupMessageListener(); // popup communication
      this.setupNavigationWatcher(); // detect page changes
      this.restoreFilterAfterRefresh(); // restore previous filter if user refreshed 
    });
  }

  // make sure every tab has keywords generated
  async ensureAllKeywordsGenerated() {
    let needsUpdate = false;

    for (const tab of this.tabs) {
      if (!tab.keywords || tab.keywords.length < 50 || !tab.keywordsGenerated) {
        const keywords = await this.keywordGenerator.generateKeywords(
          tab.name,
          tab.description,
          tab.keywords || []
        );

        tab.keywords = keywords;
        tab.keywordsGenerated = true;
        tab.generatedAt = Date.now();
        needsUpdate = true;
      }
    }

    // save to storage
    if (needsUpdate) {
      await this.saveTabs();
    }
  }

  // wait for Twitter DOM to be ready before adding dropdown UI
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

  // loads custom filters from Chrome storage
  async loadTabs() {
    if (!this.isExtensionContextValid()) {
      this.tabs = this.getDefaultTabs();
      return;
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["customTabs"], (result) => {
          if (chrome.runtime.lastError) {
            this.tabs = this.getDefaultTabs();
            resolve();
            return;
          }

          this.tabs =
            result.customTabs && result.customTabs.length > 0
              ? result.customTabs
              : this.getDefaultTabs();

          resolve();
        });
      } catch (error) {
        // don't have any tabs if there's an error
        this.tabs = this.getDefaultTabs();
        resolve();
      }
    });
  }

  // saves current tabs to Chrome storage
  async saveTabs() {
    if (!this.isExtensionContextValid()) return;

    return new Promise((resolve) => {
      chrome.storage.local.set({ customTabs: this.tabs }, () => {
        resolve();
      });
    });
  }

  // default tabs is empty array  
  getDefaultTabs() {
    return [];
  }

  // checks if extension is still working 
  isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // adds dropdown UI at top of Twitter
  injectDropdownMenu() {
    const primaryColumn = document.querySelector(
      '[data-testid="primaryColumn"]'
    );
    if (!primaryColumn) return;

    // if it already exists, return 
    if (document.querySelector(".twitter-filter-dropdown-container")) return;

    const isPostDetailPage = this.isOnPostDetailPage();

    // HTML design 
    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "twitter-filter-dropdown-container";
    dropdownContainer.innerHTML = `
      <div class="twitter-filter-dropdown">
        <button class="filter-dropdown-button ${
          isPostDetailPage ? "disabled" : ""
        }" id="filter-dropdown-toggle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="filter-icon">
            ${
              isPostDetailPage
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
          ${this.tabs
            .map(
              (tab) => `
            <div class="filter-option" data-filter="${tab.id}">
              <span>${tab.name}</span>
              <span style="font-size: 10px; opacity: 0.6; margin-left: 4px;">${
                tab.keywords?.length || 0
              }</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon hidden">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
              </svg>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    // insert at top
    primaryColumn.insertBefore(dropdownContainer, primaryColumn.firstChild);
    this.attachDropdownListeners();
    // update with current tab
    this.updateActiveFilter();
  }

  // if user is viewing a specific tweet, don't filter 
  isOnPostDetailPage() {
    const url = window.location.pathname;
    const isHomePage = url === "/home" || url === "/";
    return !isHomePage;
  }

  // attaches listeners to dropdown UI
  attachDropdownListeners() {
    const toggleButton = document.getElementById("filter-dropdown-toggle");
    const menu = document.getElementById("filter-dropdown-menu");
    const filterOptions = document.querySelectorAll(".filter-option");

    // open/close dropdown
    toggleButton?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!toggleButton.classList.contains("disabled")) {
        menu.classList.toggle("show");
      }
    });

    // close dropdown if you click outside it 
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".twitter-filter-dropdown")) {
        menu?.classList.remove("show");
      }
    });

    // if filter is clicked, get ID, apply it, and close menu
    filterOptions.forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const filterId = option.dataset.filter;
        this.setFilter(filterId === "all" ? null : filterId);
        menu.classList.remove("show");
      });
    });
  }

  // activates filter adn refreshes page to apply it 
  setFilter(filterId) {
    // if already refreshing exit
    if (this.isOnPostDetailPage() || this.isRefreshing) {
      return;
    }

    // update UI
    this.currentFilter = filterId;
    this.updateActiveFilter();

    // get full filter config 
    const filterConfig = filterId
      ? this.tabs.find((t) => t.id === filterId)
      : null;

    // send to inject.js
    window.postMessage(
      {
        type: "SET_FILTER",
        filter: filterId,
        config: filterConfig,
      },
      "*"
    );

    // refresh
    this.refreshPage();
  }

  // refreshes page
  refreshPage() {
    this.isRefreshing = true; // stop multiple refreshes at once
    this.showRefreshingIndicator(); 

    if (this.isExtensionContextValid()) {
      // save current filter so it's there after reload
      chrome.storage.local.set(
        {
          lastFilter: this.currentFilter,
          lastFilterTimestamp: Date.now(),
        },
        () => {
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      );
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  // updates dropdown UI to say it's refreshing
  showRefreshingIndicator() {
    const button = document.getElementById("filter-dropdown-toggle");
    // disable button
    if (!button) return;

    button.disabled = true;
    button.style.opacity = "0.6";
    button.style.cursor = "not-allowed";

    const label = button.querySelector(".filter-label");
    if (label) {
      label.textContent = "Refreshing...";
    }
  }

  // reapply previous filter after refresh
  async restoreFilterAfterRefresh() {
    if (!this.isExtensionContextValid()) return;

    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["lastFilter", "lastFilterTimestamp"],
        (result) => {
          if (chrome.runtime.lastError) {
            resolve();
            return;
          }

          const timestamp = result.lastFilterTimestamp || 0;
          const age = Date.now() - timestamp;

          // if last filter is less than 5 seconds old, set it as current filter
          // (only restores after intentional refresh)
          if (age < 5000 && result.lastFilter) {
            this.currentFilter = result.lastFilter;

            const filterConfig = this.tabs.find(
              (t) => t.id === result.lastFilter
            );

            if (filterConfig) {
              window.postMessage(
                {
                  type: "SET_FILTER",
                  filter: result.lastFilter,
                  config: filterConfig,
                },
                "*"
              );
            }

            this.updateActiveFilter();
            chrome.storage.local.remove(["lastFilter", "lastFilterTimestamp"]);
          }

          resolve();
        }
      );
    });
  }

  // updates UI to show which filter is currently active
  updateActiveFilter() {
    const filterLabel = document.querySelector(".filter-label");
    const checkIcons = document.querySelectorAll(".check-icon");

    checkIcons.forEach((icon) => icon.classList.add("hidden"));

    if (!this.currentFilter) {
      if (filterLabel) filterLabel.textContent = "All Tweets";
      const allOption = document.querySelector(
        '[data-filter="all"] .check-icon'
      );
      allOption?.classList.remove("hidden");
    } else {
      const selectedTab = this.tabs.find((t) => t.id === this.currentFilter);
      if (filterLabel && selectedTab) {
        filterLabel.textContent = selectedTab.name;
      }
      const selectedOption = document.querySelector(
        `[data-filter="${this.currentFilter}"] .check-icon`
      );
      selectedOption?.classList.remove("hidden");
    }
  }

  // updates dropdown after tabs are updated in popup
  updateDropdownMenu() {
    const menu = document.getElementById("filter-dropdown-menu");
    if (!menu) return;

    menu.innerHTML = `
      <div class="filter-option" data-filter="all">
        <span>All Tweets</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon ${
          !this.currentFilter ? "" : "hidden"
        }">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
        </svg>
      </div>
      ${this.tabs
        .map(
          (tab) => `
        <div class="filter-option" data-filter="${tab.id}">
          <span>${tab.name}</span>
          <span style="font-size: 10px; opacity: 0.6; margin-left: 4px;">${
            tab.keywords?.length || 0
          }</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="check-icon ${
            this.currentFilter === tab.id ? "" : "hidden"
          }">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
          </svg>
        </div>
      `
        )
        .join("")}
    `;

    this.attachDropdownListeners();
  }

  // listen for updates from popup
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "updateTabs") {
        this.loadTabs().then(() => {
          this.updateDropdownMenu();
          this.attachDropdownListeners();
        });

        sendResponse({ success: true });
        return true;
      }
    });
  }

  // detects if user goes to different twitter page
  setupNavigationWatcher() {
    let lastUrl = location.href;
    // detects URL changes
    const urlObserver = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.updateDropdownState();
        this.reinitialize();
      }
    });

    urlObserver.observe(document, { subtree: true, childList: true });

    // detects browser back/forward and updates dropdown state 
    window.addEventListener("popstate", () => {
      this.updateDropdownState();
      this.reinitialize();
    });

    // if dropdown is removed from DOM, reinject
    const dropdownObserver = new MutationObserver(() => {
      if (!document.querySelector(".twitter-filter-dropdown-container")) {
        const primaryColumn = document.querySelector(
          '[data-testid="primaryColumn"]'
        );
        if (primaryColumn) {
          this.injectDropdownMenu();
        }
      }
    });

    dropdownObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.urlObserver = urlObserver;
    this.dropdownObserver = dropdownObserver;
  }

  // updates dropdown to be enabled/disabled
  updateDropdownState() {
    const toggleButton = document.getElementById("filter-dropdown-toggle");
    const filterIcon = document.querySelector(".filter-icon");

    if (!toggleButton || !filterIcon) return;

    const isPostDetailPage = this.isOnPostDetailPage();

    if (isPostDetailPage) {
      toggleButton.classList.add("disabled");
      filterIcon.innerHTML =
        '<path d="M17 10c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1V7c0-2.76 2.24-5 5-5s5 2.24 5 5v3zm2 0v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-3.86-3.14-7-7-7S3 6.14 3 10v3c0 .55-.45 1-1 1s-1-.45-1-1v-3c0-4.97 4.03-9 9-9s9 4.03 9 9zM8 15c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-5z"/>';
    } else {
      toggleButton.classList.remove("disabled");
      filterIcon.innerHTML =
        '<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"></path>';
    }
  }

  // injects dropdown again if it's missing
  reinitialize() {
    const primaryColumn = document.querySelector(
      '[data-testid="primaryColumn"]'
    );
    if (!primaryColumn) return;

    const existingDropdown = document.querySelector(
      ".twitter-filter-dropdown-container"
    );
    if (!existingDropdown) {
      this.injectDropdownMenu();
    }
  }
}

const tabManager = new TwitterTabManager();