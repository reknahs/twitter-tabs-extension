// inject.js - Twitter Filter with Embedded Lightweight AI

console.log('🎯 TWITTER FILTER - Embedded AI Version');

// Global filter state
let CURRENT_FILTER = null;
let FILTER_CONFIG = null;

// ========== LIGHTWEIGHT AI ENGINE ==========
class EmbeddedAI {
  constructor() {
    this.vectorCache = new Map();
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s#@]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  computeTF(tokens) {
    const tf = new Map();
    const total = tokens.length;
    
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    
    for (const [token, count] of tf.entries()) {
      tf.set(token, count / total);
    }
    
    return tf;
  }

  createVector(tokens) {
    const tf = this.computeTF(tokens);
    const vector = new Map();
    
    for (const token of tokens) {
      vector.set(token, (tf.get(token) || 0) * Math.log(2));
    }
    
    return vector;
  }

  cosineSimilarity(vec1, vec2) {
    let dot = 0, norm1 = 0, norm2 = 0;
    const allTokens = new Set([...vec1.keys(), ...vec2.keys()]);
    
    for (const token of allTokens) {
      const v1 = vec1.get(token) || 0;
      const v2 = vec2.get(token) || 0;
      dot += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  analyze(text, topicConfig) {
    const tweetTokens = this.tokenize(text);
    if (tweetTokens.length === 0) return 0;
    
    // Get or create topic vector
    const cacheKey = `${topicConfig.id}-${topicConfig.keywords.join(',')}`;
    let topicVector;
    
    if (this.vectorCache.has(cacheKey)) {
      topicVector = this.vectorCache.get(cacheKey);
    } else {
      const topicText = `${topicConfig.name} ${topicConfig.description} ${topicConfig.keywords.join(' ')}`;
      const topicTokens = this.tokenize(topicText);
      topicVector = this.createVector(topicTokens);
      this.vectorCache.set(cacheKey, topicVector);
    }
    
    const tweetVector = this.createVector(tweetTokens);
    let similarity = this.cosineSimilarity(tweetVector, topicVector);
    
    // Keyword boost
    const lowerText = text.toLowerCase();
    let keywordBoost = 0;
    
    for (const keyword of topicConfig.keywords || []) {
      if (lowerText.includes(keyword.toLowerCase())) {
        keywordBoost += 0.15;
      }
    }
    
    // Named entity boost
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && /^[A-Z]/.test(word)) {
        for (const keyword of topicConfig.keywords || []) {
          if (keyword.toLowerCase().includes(word.toLowerCase())) {
            keywordBoost += 0.1;
            break;
          }
        }
      }
    }
    
    // Domain-specific terms
    if (topicConfig.id === "basketball") {
      const terms = ['game', 'score', 'team', 'player', 'shot', 'points', 'win'];
      terms.forEach(term => {
        if (lowerText.includes(term)) keywordBoost += 0.05;
      });
    } else if (topicConfig.id === "politics") {
      const terms = ['government', 'vote', 'bill', 'law', 'campaign', 'policy'];
      terms.forEach(term => {
        if (lowerText.includes(term)) keywordBoost += 0.05;
      });
    } else if (topicConfig.id === "religion") {
      const terms = ['faith', 'pray', 'church', 'god', 'blessed', 'worship'];
      terms.forEach(term => {
        if (lowerText.includes(term)) keywordBoost += 0.05;
      });
    }
    
    return Math.min(similarity + keywordBoost, 1.0);
  }
}

const ai = new EmbeddedAI();

// Listen for filter changes
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'SET_FILTER') {
    CURRENT_FILTER = event.data.filter;
    FILTER_CONFIG = event.data.config;
    console.log('🔄 Filter updated:', CURRENT_FILTER, FILTER_CONFIG);
  }
});

function isOnHomeTimeline() {
  const path = window.location.pathname;
  return path === '/home' || path === '/';
}

// ========== XHR INTERCEPTION ==========
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
                xhrState.filteredResponse = filtered !== original ? filtered : original;
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
          
          if (original && xhr.readyState === 4 && !xhrState.responseIntercepted) {
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

// ========== FETCH INTERCEPTION ==========
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

// ========== KEYWORD MATCHING FUNCTION (FROM SECOND FILE) ==========
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

// ========== FILTERING LOGIC ==========
function filterResponse(responseText) {
  if (!isOnHomeTimeline() || !CURRENT_FILTER || !FILTER_CONFIG) {
    return responseText;
  }

  console.log(`🎯 Filtering with AI: "${FILTER_CONFIG.name}"`);
  const startTime = performance.now();

  try {
    const data = JSON.parse(responseText);
    const instructions = findInstructions(data);
    
    if (!instructions) return responseText;
    
    let total = 0, kept = 0, removed = 0;
    
    instructions.forEach(inst => {
      if (inst.type === 'TimelineAddEntries' && inst.entries) {
        const filtered = [];
        
        inst.entries.forEach((entry) => {
          // Keep cursors
          if (entry.entryId?.startsWith('cursor-')) {
            filtered.push(entry);
            return;
          }
          
          // Keep non-tweets
          if (!entry.entryId?.startsWith('tweet-') && 
              !entry.entryId?.startsWith('home-conversation-') &&
              !entry.entryId?.startsWith('conversationthread-')) {
            filtered.push(entry);
            return;
          }
          
          total++;
          const text = extractTextFromEntry(entry);
          
          if (!text) {
            filtered.push(entry);
            kept++;
            return;
          }
          
          // PHASE 1: Keyword Check (Fast Pass) - Using exact method from second file
          const lowerText = text.toLowerCase();
          const keywordMatch = matchesFilter(lowerText);
          
          if (keywordMatch) {
            // Direct pass - keyword scoring passed, but still run AI for debugging
            const similarity = ai.analyze(text, FILTER_CONFIG);
            filtered.push(entry);
            kept++;
            console.log(`🚀 KEYWORD PASS (AI: ${(similarity * 100).toFixed(0)}%) - "${text.slice(0, 50)}..."`);
            console.log(`📝 FULL TWEET TEXT:\n${text}\n${'─'.repeat(80)}`);
          } else {
            // PHASE 2: AI Semantic Analysis (Only if no keyword match)
            const similarity = ai.analyze(text, FILTER_CONFIG);
            const threshold = FILTER_CONFIG.keywords.length > 15 ? 0.2 : 0.25;
            const matches = similarity > threshold;
            
            console.log(`🤖 AI Analysis: ${(similarity * 100).toFixed(0)}% similarity - "${text.slice(0, 50)}..."`);
            
            if (matches) {
              filtered.push(entry);
              kept++;
              console.log(`✅ AI PASS - ${(similarity * 100).toFixed(0)}%`);
              console.log(`📝 FULL TWEET TEXT:\n${text}\n${'─'.repeat(80)}`);
            } else {
              removed++;
              console.log(`❌ FILTERED OUT - ${(similarity * 100).toFixed(0)}% (below ${(threshold * 100).toFixed(0)}% threshold)`);
            }
          }
        });
        
        // Ensure at least one content entry
        const contentEntries = filtered.filter(e => 
          e.entryId?.startsWith('tweet-') || 
          e.entryId?.startsWith('home-conversation-') ||
          e.entryId?.startsWith('conversationthread-')
        );
        
        if (contentEntries.length === 0 && inst.entries.length > 2) {
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
    
    const elapsed = performance.now() - startTime;
    console.log(`📊 "${FILTER_CONFIG.name}": ${total} tweets → ${kept} kept, ${removed} removed (${elapsed.toFixed(1)}ms)`);
    
    window.postMessage({ 
      type: 'FILTER_STATS', 
      hasResults: kept > 0,
      total, kept, removed,
      filterName: FILTER_CONFIG.name
    }, '*');
    
    return JSON.stringify(data);
    
  } catch (e) {
    console.error('❌ Filter error:', e);
    return responseText;
  }
}

function extractTextFromEntry(entry) {
  // Handle threads
  if (entry.entryId?.startsWith('home-conversation-') || 
      entry.entryId?.startsWith('conversationthread-')) {
    const items = entry.content?.items;
    if (!items?.length) return null;
    
    const texts = [];
    items.forEach((item) => {
      const result = item.item?.itemContent?.tweet_results?.result;
      const legacy = result?.legacy || result?.tweet?.legacy;
      if (!legacy) return;
      
      const user = result.core?.user_results?.result?.legacy?.screen_name || 
                   result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
      const text = legacy.full_text || '';
      
      if ((user + text).trim()) {
        texts.push(user + ' ' + text);
      }
    });
    
    return texts.join(' ');
  }
  
  // Handle regular tweets
  try {
    const result = entry.content?.itemContent?.tweet_results?.result;
    const legacy = result?.legacy || result?.tweet?.legacy;
    if (!legacy) return null;
    
    const user = result.core?.user_results?.result?.legacy?.screen_name || 
                 result.tweet?.core?.user_results?.result?.legacy?.screen_name || '';
    const text = legacy.full_text || '';
    
    return user + ' ' + text;
  } catch (e) {
    return null;
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

console.log('✅ AI-powered filter ready (embedded engine)');