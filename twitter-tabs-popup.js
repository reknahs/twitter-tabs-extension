// use groq as default provider
let selectedProvider = "groq";

// teporary success message at top right of popup
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// shows all the keywords for a specific filter
function showKeywordsModal(tab) {
  const modal = document.createElement("div");
  modal.className = "keywords-modal";

  // copy of keywords array
  let currentKeywords = [...(tab.keywords || [])];

  // displays all keywords
  function renderKeywords() {
    const keywordsListDiv = modal.querySelector(".keywords-list");
    if (currentKeywords.length === 0) {
      keywordsListDiv.innerHTML =
        '<p class="no-keywords">No keywords yet. Add some below or they will be generated when you visit Twitter.</p>';
    } else {
      // for every keyword add it with delete button
      keywordsListDiv.innerHTML = currentKeywords
        .map(
          (kw, index) => `
          <span class="keyword-chip">
            ${kw}
            <button class="delete-keyword-btn" data-index="${index}" title="Remove keyword">X</button>
          </span>
        `
        )
        .join("");

      // delete listeners
      keywordsListDiv.querySelectorAll(".delete-keyword-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const index = parseInt(e.target.dataset.index);
          currentKeywords.splice(index, 1);
          renderKeywords();
          updateStats();
        });
      });
    }
  }

  // updates stats at top
  function updateStats() {
    const statsDiv = modal.querySelector(".keywords-stats");
    statsDiv.innerHTML = `
      <span class="stat-badge">Total: ${currentKeywords.length}</span>
      <span class="stat-badge ${tab.keywordsGenerated ? "success" : "pending"}">
        ${tab.keywordsGenerated ? "Generated" : "Pending"}
      </span>
    `;
  }

  // modal structure
  modal.innerHTML = `
    <div class="keywords-modal-content">
      <div class="keywords-modal-header">
        <h3>Keywords for "${tab.name}"</h3>
        <button class="close-modal-btn">X</button>
      </div>
      <div class="keywords-modal-body">
        <div class="keywords-stats"></div>
        <div class="keywords-list"></div>
      </div>
      <div class="keywords-modal-footer">
        <div class="add-keyword-section">
          <input type="text" class="add-keyword-input" id="new-keyword-input" placeholder="Add keyword">
          <button class="btn-secondary" id="add-keyword-btn">Add</button>
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" id="copy-keywords-btn">Copy All</button>
          <button class="btn-primary" id="save-keywords-btn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // initial render
  renderKeywords();
  updateStats();

  // close modal
  modal.querySelector(".close-modal-btn").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // click outside to close as well
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // can add keywords
  const addKeywordBtn = modal.querySelector("#add-keyword-btn");
  const keywordInput = modal.querySelector("#new-keyword-input");

  // add keywords
  function addKeyword() {
    const keyword = keywordInput.value.trim().toLowerCase();
    if (keyword && !currentKeywords.includes(keyword)) {
      // trim white space, convert to lowercase, check if it's not already there
      currentKeywords.push(keyword);
      keywordInput.value = "";
      renderKeywords();
      updateStats();
      showToast("Keyword added");
    } else if (currentKeywords.includes(keyword)) {
      showToast("Keyword already exists");
    }
  }

  addKeywordBtn.addEventListener("click", addKeyword);

  // enter key adds the keyword
  keywordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addKeyword();
    }
  });

  // copy all keywords to clipboard
  modal.querySelector("#copy-keywords-btn").addEventListener("click", () => {
    if (currentKeywords.length > 0) {
      navigator.clipboard.writeText(currentKeywords.join(", ")).then(() => {
        showToast("Keywords copied to clipboard!");
      });
    } else {
      showToast("No keywords to copy");
    }
  });

  // save button to save keywords to Chrome storage
  modal.querySelector("#save-keywords-btn").addEventListener("click", () => {
    chrome.storage.local.get(["customTabs"], (result) => {
      const tabs = result.customTabs || [];
      const tabIndex = tabs.findIndex((t) => t.id === tab.id);

      if (tabIndex !== -1) {
        tabs[tabIndex].keywords = currentKeywords;
        tabs[tabIndex].keywordsGenerated = currentKeywords.length > 0;

        chrome.storage.local.set({ customTabs: tabs }, () => {
          showToast("Keywords saved!");
          document.body.removeChild(modal);
          loadTabs();

          // send to content script
          chrome.tabs.query(
            { active: true, currentWindow: true },
            (activeTabs) => {
              if (
                activeTabs[0]?.url?.includes("twitter.com") ||
                activeTabs[0]?.url?.includes("x.com")
              ) {
                chrome.tabs.sendMessage(activeTabs[0].id, {
                  action: "updateTabs",
                });
              }
            }
          );
        });
      }
    });
  });
}

// loads tabs
function loadTabs() {
  // get all tabs from storage
  chrome.storage.local.get(["customTabs"], (result) => {
    const tabs = result.customTabs || [];
    const container = document.getElementById("tabs-container");

    // if no tabs yet 
    if (tabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
          </svg>
          <div>No filters yet</div>
          <div style="font-size: 12px; margin-top: 4px;">Add your first filter below</div>
        </div>
      `;
      return;
    }

    // renders each tab with HTML 
    container.innerHTML = tabs
      .map((tab, index) => {
        const sanitizedName = (tab.name || "").replace(/"/g, "&quot;");
        const sanitizedDesc = (tab.description || "").replace(/"/g, "&quot;");
        const keywordCount = tab.keywords?.length || 0;

        return `
        <div class="tab-item">
          <div class="tab-info">
            <div class="tab-name">${sanitizedName}</div>
            <div class="tab-desc">${sanitizedDesc}</div>
            <div class="tab-keywords-row">
              <span class="tab-keywords">${keywordCount} keywords</span>
              <button class="view-keywords-btn" data-index="${index}">View</button>
            </div>
          </div>
          <button class="delete-btn" data-index="${index}">Delete</button>
        </div>
      `;
      })
      .join("");

    // add listeners for view keywords
    const viewButtons = document.querySelectorAll(".view-keywords-btn");

    viewButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        showKeywordsModal(tabs[index]);
      });
    });

    // add delete listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        const tabName = tabs[index].name;

        if (
          confirm(`Delete "${tabName}" filter and all its cached keywords?`)
        ) {
          deleteTab(index);
        }
      });
    });
  });
}

// deletes tab
function deleteTab(index) {
  // delete it from chrome storage
  chrome.storage.local.get(["customTabs"], (result) => {
    const tabs = result.customTabs || [];
    const deletedName = tabs[index].name;
    tabs.splice(index, 1);

    chrome.storage.local.set({ customTabs: tabs }, () => {
      loadTabs();
      showToast(`"${deletedName}" deleted`);

      // send to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (
          tabs[0]?.url?.includes("twitter.com") ||
          tabs[0]?.url?.includes("x.com")
        ) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateTabs" });
        }
      });
    });
  });
}

// initialize popup is loaded
document.addEventListener("DOMContentLoaded", () => {
  // provider selection
  document.querySelectorAll(".provider-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".provider-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedProvider = btn.dataset.provider;
    });
  });

  // load saved provider
  chrome.storage.local.get(["selectedProvider"], (result) => {
    if (result.selectedProvider) {
      selectedProvider = result.selectedProvider;
      document
        .querySelector(`[data-provider="${selectedProvider}"]`)
        ?.classList.add("active");
    } else {
      document.querySelector('[data-provider="groq"]')?.classList.add("active");
    }
  });

  // adds new tab
  document.getElementById("add-tab-btn").addEventListener("click", async () => {
    const name = document.getElementById("new-tab-name").value.trim();
    const description = document.getElementById("new-tab-desc").value.trim();

    if (!name || !description) {
      alert("Please provide both name and description");
      return;
    }

    const btn = document.getElementById("add-tab-btn");
    btn.disabled = true;
    btn.textContent = "Generating keywords...";

    // new filter
    chrome.storage.local.get(["customTabs"], (result) => {
      const tabs = result.customTabs || [];
      tabs.push({
        id: name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
        name,
        description,
        keywords: [],
        keywordsGenerated: false,
      });

      chrome.storage.local.set({ customTabs: tabs }, () => {
        // clear inputs
        document.getElementById("new-tab-name").value = "";
        document.getElementById("new-tab-desc").value = "";

        btn.disabled = false;
        btn.textContent = "Generate & Add Filter";

        // reload tabs
        loadTabs();
        showToast("Filter added! Keywords will generate on next page load.");

        // send to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (
            tabs[0]?.url?.includes("twitter.com") ||
            tabs[0]?.url?.includes("x.com")
          ) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "updateTabs" });
          }
        });
      });
    });
  });

  // clears all data
  document.getElementById("clear-all-btn").addEventListener("click", () => {
    if (
      confirm(
        "DELETE ALL FILTERS AND KEYWORDS?\n\nThis will:\nDelete all custom filters\nClear all cached keywords\nReset to default state\n\nThis will NOT delete your saved API keys.\n\nThis cannot be undone!"
      )
    ) {
      // only clear customTabs, keep all stored API keys
      chrome.storage.local.remove(
        ["customTabs", "lastFilter", "lastFilterTimestamp"],
        () => {
          loadTabs();
          showToast("All filters cleared! API keys preserved.");

          // tells content script to reload
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (
              tabs[0]?.url?.includes("twitter.com") ||
              tabs[0]?.url?.includes("x.com")
            ) {
              chrome.tabs.reload(tabs[0].id);
            }
          });
        }
      );
    }
  });

  // save API key
  document.getElementById("save-api-btn").addEventListener("click", () => {
    const apiKey = document.getElementById("api-key").value.trim();

    // if nothing entered, try again
    if (!apiKey) {
      alert("Please enter an API key");
      return;
    }

    const keyName = `${selectedProvider.toUpperCase()}_API_KEY`;

    chrome.storage.local.set(
      {
        [keyName]: apiKey,
        selectedProvider: selectedProvider,
      },
      () => {
        showToast(
          `${
            selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)
          } API key saved!`
        );
        document.getElementById("api-key").value = "";
      }
    );
  });

  // loads API key status
  chrome.storage.local.get(["GROQ_API_KEY", "OPENAI_API_KEY"], (result) => {
    if (result.GROQ_API_KEY || result.OPENAI_API_KEY) {
      document.getElementById("api-key").placeholder =
        "API key saved (enter new to update)";
    }
  });

  // Initial load
  loadTabs();
});
