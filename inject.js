// inject.js - Dynamic Twitter Filter with Response Interception
console.log('🎯 DYNAMIC TWITTER FILTER v1.0');

// Global filter state
let CURRENT_FILTER = null;
let FILTER_CONFIG = null;

// Listen for filter changes from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'SET_FILTER') {
    console.log('📥 Received filter change:', event.data);
    CURRENT_FILTER = event.data.filter;
    FILTER_CONFIG = event.data.config;
    
    console.log('🔄 Filter updated:', CURRENT_FILTER, FILTER_CONFIG);
  }
});

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
    xhrState.isTwitterAPI = xhrState.url.includes('HomeTimeline') || 
                            xhrState.url.includes('HomeLatestTimeline') ||
                            (xhrState.url.includes('graphql') && xhrState.url.includes('timeline'));
    
    if (xhrState.isTwitterAPI) {
      console.log('🔵 Detected Twitter Timeline API:', xhrState.url.substring(0, 80));
    }
    
    return originalOpen.call(this, method, url, ...args);
  };
  
  xhr.send = function(...args) {
    if (xhrState.isTwitterAPI) {
      Object.defineProperty(xhr, 'responseText', {
        get: function() {
          const original = originalResponseTextGetter.call(xhr);
          
          if (original && !xhrState.responseIntercepted && xhr.readyState === 4) {
            xhrState.responseIntercepted = true;
            xhrState.originalResponse = original;
            
            console.log('📦 Intercepted response:', original.length, 'bytes');
            
            try {
              const filtered = filterResponse(original);
              if (filtered !== original) {
                xhrState.filteredResponse = filtered;
                console.log('✅ Response filtered:', filtered.length, 'bytes');
              } else {
                xhrState.filteredResponse = original;
              }
            } catch (e) {
              console.error('❌ Filter error:', e);
              xhrState.filteredResponse = original;
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
          
          if (original && !xhrState.responseIntercepted && xhr.readyState === 4) {
            xhrState.responseIntercepted = true;
            
            try {
              const originalText = typeof original === 'string' ? original : JSON.stringify(original);
              xhrState.originalResponse = originalText;
              
              console.log('📦 Intercepted response object:', originalText.length, 'bytes');
              
              const filtered = filterResponse(originalText);
              if (filtered !== originalText) {
                xhrState.filteredResponse = filtered;
                console.log('✅ Response filtered:', filtered.length, 'bytes');
                return xhr.responseType === 'json' ? JSON.parse(filtered) : filtered;
              }
            } catch (e) {
              console.error('❌ Filter error:', e);
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
console.log('✅ XHR response getter override installed');

// ========== FETCH API INTERCEPTION ==========
const originalFetch = window.fetch;

window.fetch = async function(resource, options) {
  const url = typeof resource === 'string' ? resource : resource.url;
  const isTwitterAPI = url && (
    url.includes('HomeTimeline') || 
    url.includes('HomeLatestTimeline') ||
    (url.includes('graphql') && url.includes('timeline'))
  );
  
  if (isTwitterAPI) {
    console.log('🟣 Detected Twitter Timeline FETCH:', url.substring(0, 80));
  }
  
  const response = await originalFetch.apply(this, arguments);
  
  if (!isTwitterAPI) {
    return response;
  }
  
  const clonedResponse = response.clone();
  
  try {
    const originalText = await clonedResponse.text();
    console.log('📦 Intercepted FETCH response:', originalText.length, 'bytes');
    
    const filteredText = filterResponse(originalText);
    
    if (filteredText !== originalText) {
      console.log('✅ FETCH response filtered:', filteredText.length, 'bytes');
      
      return new Response(filteredText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (e) {
    console.error('❌ FETCH filter error:', e);
  }
  
  return response;
};

console.log('✅ Fetch API override installed');

// ========== FILTERING LOGIC ==========

function filterResponse(responseText) {
  // If no filter is active, return original
  if (!CURRENT_FILTER || !FILTER_CONFIG) {
    console.log('⚪ No filter active, passing through');
    return responseText;
  }

  try {
    const data = JSON.parse(responseText);
    const instructions = findInstructions(data);
    
    if (!instructions) {
      console.log('⚠️ No timeline instructions found');
      return responseText;
    }
    
    let total = 0, kept = 0, removed = 0;
    
    instructions.forEach(inst => {
      if (inst.type === 'TimelineAddEntries' && inst.entries) {
        const filtered = [];
        
        inst.entries.forEach(entry => {
          // Keep non-tweet entries (cursors, prompts, etc.)
          if (!entry.entryId?.startsWith('tweet-')) {
            filtered.push(entry);
            return;
          }
          
          total++;
          const text = extractTweetText(entry);
          
          if (!text) {
            filtered.push(entry);
            kept++;
            return;
          }
          
          if (matchesFilter(text)) {
            filtered.push(entry);
            kept++;
            console.log('✅', text.substring(0, 60));
          } else {
            removed++;
            console.log('❌', text.substring(0, 60));
          }
        });
        
        inst.entries = filtered;
      }
    });
    
    console.log(`📊 FILTER "${FILTER_CONFIG.name}": ${total} tweets → ${kept} kept, ${removed} removed`);
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
    console.error('❌ Text extraction error:', e);
    return null;
  }
}

function matchesFilter(text) {
  if (!FILTER_CONFIG) return false;
  
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

console.log('✅ Dynamic filter ready');

// ========== DEBUG UTILITIES ==========

window.checkCurrentFilter = function() {
  console.log('\n🔍 Current Filter Status:');
  console.log('Filter ID:', CURRENT_FILTER);
  console.log('Filter Config:', FILTER_CONFIG);
};

window.testFilterMatch = (text) => {
  const result = matchesFilter(text.toLowerCase());
  console.log(result ? '✅ Matches filter' : '❌ Does not match filter');
  return result;
};