// inject.js - Dynamic Twitter Filter with Thread Support

console.log('🎯 TWITTER FILTER - Thread-Aware Version');

// Global filter state
let CURRENT_FILTER = null;
let FILTER_CONFIG = null;

// Listen for filter changes from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'SET_FILTER') {
    CURRENT_FILTER = event.data.filter;
    FILTER_CONFIG = event.data.config;
    console.log('🔄 Filter updated:', CURRENT_FILTER, FILTER_CONFIG);
  }
});

// Helper function to check if we're on home timeline
function isOnHomeTimeline() {
  const path = window.location.pathname;
  return path === '/home' || path === '/';
}

// ========== XHR RESPONSE INTERCEPTION ==========
const OriginalXHR = window.XMLHttpRequest;
const originalResponseTextGetter = Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'responseText').get;
const originalResponseGetter = Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'response').get;

window.XMLHttpRequest = function() {
  const xhr = new OriginalXHR();
  const xhrState = {
    url: '',
    isTwitterAPI: false,
    originalResponse: null,
    filteredResponse: null,
    responseIntercepted: false
  };
  
  const originalOpen = xhr.open;
  const originalSend = xhr.send;
  
  xhr.open = function(method, url, ...args) {
    xhrState.url = String(url);
    xhrState.isTwitterAPI = xhrState.url.includes('/graphql/');
    return originalOpen.call(this, method, url, ...args);
  };
  
  xhr.send = function(...args) {
    if (xhrState.isTwitterAPI && isOnHomeTimeline()) {
      Object.defineProperty(xhr, 'responseText', {
        get: function() {
          const original = originalResponseTextGetter.call(xhr);
          
          if (original && xhr.readyState === 4) {
            if (!xhrState.responseIntercepted) {
              xhrState.responseIntercepted = true;
              xhrState.originalResponse = original;
              
              try {
                const filtered = filterResponse(original);
                if (filtered !== original) {
                  xhrState.filteredResponse = filtered;
                } else {
                  xhrState.filteredResponse = original;
                }
              } catch (e) {
                console.error('❌ Filter error:', e);
                xhrState.filteredResponse = original;
              }
            }
          }
          
          return xhrState.filteredResponse || original;
        },
        configurable: true
      });
      
      Object.defineProperty(xhr, 'response', {
        get: function() {
          if (xhrState.filteredResponse && (xhr.responseType === '' || xhr.responseType === 'text')) {
            return xhrState.filteredResponse;
          }
          
          const original = originalResponseGetter.call(xhr);
          
          if (original && xhr.readyState === 4) {
            if (!xhrState.responseIntercepted) {
              xhrState.responseIntercepted = true;
              
              try {
                const originalText = typeof original === 'string' ? original : JSON.stringify(original);
                xhrState.originalResponse = originalText;
                
                const filtered = filterResponse(originalText);
                if (filtered !== originalText) {
                  xhrState.filteredResponse = filtered;
                  return xhr.responseType === 'json' ? JSON.parse(filtered) : filtered;
                }
              } catch (e) {
                console.error('❌ Filter error:', e);
              }
            }
          }
          
          return original;
        },
        configurable: true
      });
    }
    
    return originalSend.call(xhr, ...args);
  };
  
  return xhr;
};

window.XMLHttpRequest.prototype = OriginalXHR.prototype;

// ========== FETCH API INTERCEPTION ==========
const originalFetch = window.fetch;

window.fetch = async function(resource, options) {
  const url = typeof resource === 'string' ? resource : resource.url;
  
  const isTwitterAPI = url && url.includes('/graphql/');
  const response = await originalFetch.apply(this, arguments);
  
  if (!isTwitterAPI || !isOnHomeTimeline()) {
    return response;
  }
  
  const clonedResponse = response.clone();
  
  try {
    const originalText = await clonedResponse.text();
    const filteredText = filterResponse(originalText);
    
    if (filteredText !== originalText) {
      return new Response(filteredText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (e) {
    console.error('❌ Fetch filter error:', e);
  }
  
  return response;
};

// ========== FILTERING LOGIC ==========

function filterResponse(responseText) {
  if (!isOnHomeTimeline()) {
    return responseText;
  }
  
  // If no filter is active, return original
  if (!CURRENT_FILTER || !FILTER_CONFIG) {
    window.postMessage({ type: 'FILTER_STATS', hasResults: true }, '*');
    return responseText;
  }

  console.log('🎯 Filtering with:', FILTER_CONFIG.name);

  try {
    const data = JSON.parse(responseText);
    const instructions = findInstructions(data);
    
    if (!instructions) {
      return responseText;
    }
    
    let total = 0, kept = 0, removed = 0;
    
    instructions.forEach(inst => {
      if (inst.type === 'TimelineAddEntries' && inst.entries) {
        const filtered = [];
        
        inst.entries.forEach((entry) => {
          // CRITICAL: Keep cursor entries - they're needed for infinite scroll
          if (entry.entryId?.startsWith('cursor-')) {
            filtered.push(entry);
            console.log('✅ Kept cursor:', entry.entryId);
            return;
          }
          
          // Keep non-tweet entries (prompts, etc.)
          if (!entry.entryId?.startsWith('tweet-') && 
              !entry.entryId?.startsWith('home-conversation-') &&
              !entry.entryId?.startsWith('conversationthread-')) {
            filtered.push(entry);
            return;
          }
          
          total++;
          
          // Handle home-conversation entries (threads)
          if (entry.entryId?.startsWith('home-conversation-')) {
            console.log('🧵 Checking thread:', entry.entryId);
            
            const items = entry.content?.items;
            
            if (!items || !Array.isArray(items)) {
              filtered.push(entry);
              kept++;
              return;
            }
            
            // Collect all text from all tweets in the thread
            const threadTexts = [];
            
            items.forEach((item) => {
              const result = item.item?.itemContent?.tweet_results?.result;
              if (!result) return;
              
              const legacy = result.legacy || result.tweet?.legacy;
              if (!legacy) return;
              
              const user = result.core?.user_results?.result?.legacy?.screen_name || 
                           result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
              const text = legacy.full_text || '';
              const combined = (user + ' ' + text).toLowerCase();
              
              if (combined) {
                threadTexts.push(combined);
              }
            });
            
            if (threadTexts.length === 0) {
              filtered.push(entry);
              kept++;
              return;
            }
            
            // Evaluate ALL tweets in thread together
            const threadMatches = threadTexts.some(text => matchesFilter(text));
            
            if (threadMatches) {
              filtered.push(entry);
              kept++;
              console.log('✅ Thread KEPT (matched filter)');
            } else {
              removed++;
              console.log('❌ Thread REMOVED (no match)');
            }
            
            return;
          }
          
          // Handle conversationthread entries (alternative thread format)
          if (entry.entryId?.startsWith('conversationthread-')) {
            console.log('🧵 Checking conversationthread:', entry.entryId);
            
            const items = entry.content?.items;
            
            if (!items || !Array.isArray(items)) {
              filtered.push(entry);
              kept++;
              return;
            }
            
            // Collect all text from thread
            const threadTexts = [];
            
            items.forEach((item) => {
              const result = item.item?.itemContent?.tweet_results?.result;
              if (!result) return;
              
              const legacy = result.legacy || result.tweet?.legacy;
              if (!legacy) return;
              
              const user = result.core?.user_results?.result?.legacy?.screen_name || 
                           result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
              const text = legacy.full_text || '';
              const combined = (user + ' ' + text).toLowerCase();
              
              if (combined) {
                threadTexts.push(combined);
              }
            });
            
            if (threadTexts.length === 0) {
              filtered.push(entry);
              kept++;
              return;
            }
            
            // Evaluate thread collectively
            const threadMatches = threadTexts.some(text => matchesFilter(text));
            
            if (threadMatches) {
              filtered.push(entry);
              kept++;
              console.log('✅ Conversationthread KEPT');
            } else {
              removed++;
              console.log('❌ Conversationthread REMOVED');
            }
            
            return;
          }
          
          // Handle regular tweets
          const text = extractTweetText(entry);
          
          if (!text) {
            filtered.push(entry);
            kept++;
            return;
          }
          
          const result = matchesFilter(text);
          
          if (result) {
            filtered.push(entry);
            kept++;
          } else {
            removed++;
          }
        });
        
        // CRITICAL FIX: If filtering resulted in ONLY cursors (no content),
        // keep at least one tweet to prevent Twitter from stopping pagination
        const contentEntries = filtered.filter(e => 
          e.entryId?.startsWith('tweet-') || 
          e.entryId?.startsWith('home-conversation-') ||
          e.entryId?.startsWith('conversationthread-')
        );
        
        if (contentEntries.length === 0 && inst.entries.length > 2) {
          // Find first tweet/thread from original entries and keep it
          const firstContent = inst.entries.find(e => 
            e.entryId?.startsWith('tweet-') || 
            e.entryId?.startsWith('home-conversation-') ||
            e.entryId?.startsWith('conversationthread-')
          );
          
          if (firstContent) {
            filtered.push(firstContent);
            console.log('⚠️ No matches found - keeping one tweet to maintain pagination');
            kept++;
          }
        }
        
        inst.entries = filtered;
      }
    });
    
    console.log(`📊 FILTER "${FILTER_CONFIG.name}": ${total} items → ${kept} kept, ${removed} removed`);
    console.log(`📍 Total entries in response: ${instructions.reduce((sum, inst) => sum + (inst.entries?.length || 0), 0)}`);
    console.log(`📍 Entries after filtering: ${instructions.reduce((sum, inst) => sum + (inst.entries?.length || 0), 0)}`);
    
    // Notify content script about results
    window.postMessage({ 
      type: 'FILTER_STATS', 
      hasResults: kept > 0,
      total,
      kept,
      removed,
      filterName: FILTER_CONFIG.name
    }, '*');
    
    return JSON.stringify(data);
    
  } catch (e) {
    console.error('❌ Filter error:', e);
    return responseText;
  }
}

function findInstructions(data) {
  const paths = [
    data?.data?.home?.home_timeline_urt?.instructions,
    data?.data?.home_timeline_urt?.instructions,
    data?.data?.user?.result?.timeline_v2?.timeline?.instructions
  ];
  
  for (const path of paths) {
    if (path?.some?.(i => i.type === 'TimelineAddEntries')) {
      return path;
    }
  }
  
  function search(obj, depth = 0) {
    if (depth > 6 || !obj || typeof obj !== 'object') return null;
    
    if (Array.isArray(obj?.instructions)) {
      if (obj.instructions.some(i => i.type === 'TimelineAddEntries')) {
        return obj.instructions;
      }
    }
    
    for (const key in obj) {
      const result = search(obj[key], depth + 1);
      if (result) return result;
    }
    
    return null;
  }
  
  return data.data ? search(data.data) : null;
}

function extractTweetText(entry) {
  try {
    const result = entry.content?.itemContent?.tweet_results?.result;
    if (!result) return null;
    
    const legacy = result.legacy || result.tweet?.legacy;
    if (!legacy) return null;
    
    const user = result.core?.user_results?.result?.legacy?.screen_name || 
                 result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
    
    const text = legacy.full_text || '';
    
    return (user + ' ' + text).toLowerCase();
  } catch (e) {
    return null;
  }
}

function matchesFilter(text) {
  if (!FILTER_CONFIG) {
    return false;
  }
  
  let score = 0;
  
  // Check keywords (higher weight)
  for (const kw of FILTER_CONFIG.keywords || []) {
    if (text.includes(kw.toLowerCase())) {
      score += 3;
    }
  }
  
  // Check description terms (lower weight)
  const descWords = FILTER_CONFIG.description.toLowerCase().split(/\s+/);
  for (const word of descWords) {
    if (word.length > 3 && text.includes(word)) {
      score += 1;
    }
  }
  
  // Need at least 1 keyword OR multiple description terms
  return score >= 3;
}

console.log('✅ Thread-aware filter ready');