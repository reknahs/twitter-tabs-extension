// inject.js - Basketball filter with proper response interception
console.log('🏀 BASKETBALL FILTER v5.0 - Response Getter Override');

const BASKETBALL_CONFIG = {
  keywords: ['nba', 'basketball', 'lakers', 'lebron', 'curry', 'dunk', 'playoffs', 'warriors', 'celtics', 'nets', 'heat', 'bulls', 'knicks', 'spurs', 'mavs', 'bucks', 'suns', 'sixers', 'tatum', 'giannis', 'jokic', 'embiid', 'harden', 'durant', 'kawhi', 'dame', 'luka', 'booker'],
  terms: ['game', 'score', 'team', 'player', 'coach', 'court', 'shot', 'rebound', 'assist', 'quarter', 'timeout', 'finals', 'championship', 'playoff', 'arena', 'draft', 'trade', 'roster', 'mvp', 'points']
};

// ========== PROPER XHR RESPONSE INTERCEPTION ==========
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
  
  // Store original open/send
  const originalOpen = xhr.open;
  const originalSend = xhr.send;
  
  // Override open to detect Twitter API calls
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
  
  // Override send to set up response interception
  xhr.send = function(...args) {
    if (xhrState.isTwitterAPI) {
      // Override response getters BEFORE the request completes
      Object.defineProperty(xhr, 'responseText', {
        get: function() {
          const original = originalResponseTextGetter.call(xhr);
          
          // First time seeing the response - filter it
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
          
          // Return filtered response if available
          return xhrState.filteredResponse || original;
        },
        configurable: true
      });
      
      Object.defineProperty(xhr, 'response', {
        get: function() {
          // If we have filtered text response, return it
          if (xhrState.filteredResponse && xhr.responseType === '' || xhr.responseType === 'text') {
            return xhrState.filteredResponse;
          }
          
          // Otherwise use original getter
          const original = originalResponseGetter.call(xhr);
          
          // Try to filter if it's JSON and we haven't yet
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

// Preserve prototype chain
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
  
  // Clone the response so we can read it
  const clonedResponse = response.clone();
  
  try {
    const originalText = await clonedResponse.text();
    console.log('📦 Intercepted FETCH response:', originalText.length, 'bytes');
    
    const filteredText = filterResponse(originalText);
    
    if (filteredText !== originalText) {
      console.log('✅ FETCH response filtered:', filteredText.length, 'bytes');
      
      // Return a new response with filtered data
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
            filtered.push(entry); // Keep if can't extract text
            kept++;
            return;
          }
          
          if (isBasketball(text)) {
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
    
    console.log(`📊 FILTER RESULT: ${total} tweets → ${kept} kept, ${removed} removed`);
    return JSON.stringify(data);
    
  } catch (e) {
    console.error('❌ Filter error:', e);
    return responseText;
  }
}

function findInstructions(data) {
  // Try common Twitter API response structures
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
  
  // Deep search as fallback
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
    
    // Handle different result structures
    const legacy = result.legacy || result.tweet?.legacy;
    if (!legacy) return null;
    
    // Get username
    const user = result.core?.user_results?.result?.legacy?.screen_name || 
                 result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
    
    // Get tweet text
    const text = legacy.full_text || '';
    
    // Combine and lowercase for matching
    return (user + ' ' + text).toLowerCase();
  } catch (e) {
    console.error('❌ Text extraction error:', e);
    return null;
  }
}

function isBasketball(text) {
  let score = 0;
  
  // Check keywords (higher weight)
  for (const kw of BASKETBALL_CONFIG.keywords) {
    if (text.includes(kw)) {
      score += 3;
    }
  }
  
  // Check general terms (lower weight)
  for (const term of BASKETBALL_CONFIG.terms) {
    if (text.includes(term)) {
      score += 1;
    }
  }
  
  // Threshold: need at least 1 keyword OR multiple terms
  return score >= 3;
}

console.log('✅ Basketball filter ready');

// ========== DEBUG UTILITIES ==========

window.checkPageTweets = function() {
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  console.log(`\n🔍 Found ${tweets.length} tweets on page`);
  
  let basketballCount = 0;
  let nonBasketballCount = 0;
  const rogueTweets = [];
  
  tweets.forEach((tweet, i) => {
    const textEl = tweet.querySelector('[data-testid="tweetText"]');
    const text = textEl ? textEl.textContent : '';
    const user = tweet.querySelector('[data-testid="User-Name"]')?.textContent || '';
    
    const fullText = (user + ' ' + text).toLowerCase();
    const passes = isBasketball(fullText);
    
    if (passes) {
      basketballCount++;
    } else {
      nonBasketballCount++;
      rogueTweets.push({ user, text: text.substring(0, 100) });
      console.log(`❌ ROGUE TWEET ${i + 1}:`, text.substring(0, 80));
    }
  });
  
  console.log(`\n📊 Summary: ${basketballCount} basketball, ${nonBasketballCount} non-basketball tweets`);
  
  if (rogueTweets.length > 0) {
    console.log('\n🚨 ROGUE TWEETS DETECTED:');
    rogueTweets.forEach((t, i) => {
      console.log(`${i + 1}. @${t.user}: ${t.text}`);
    });
  }
  
  return { basketballCount, nonBasketballCount, rogueTweets };
};

window.testBasketball = (text) => {
  const result = isBasketball(text.toLowerCase());
  console.log(result ? '✅ Basketball' : '❌ Not basketball');
  return result;
};

// Auto-check after page load
setTimeout(() => {
  console.log('\n🔍 Auto-checking page tweets...');
  window.checkPageTweets();
}, 5000);