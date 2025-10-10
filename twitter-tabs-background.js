// handles API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // classify tweet 
  console.log("testing");
  if (request.action === 'analyzeWithAI') {
    const result = performKeywordAnalysis(request.text, request.tabConfig);
    sendResponse(result);
  }
});

// for classifying tweets
function performKeywordAnalysis(text, tabConfig) {
  console.log("Background analyzing tweet...");

  let score = 0;
  const lowerText = text.toLowerCase();

  // Check keywords
  for (const keyword of tabConfig.keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 2;
    }
  }

  // Check description words
  const descWords = tabConfig.description.toLowerCase().split(/\s+/);
  for (const word of descWords) {
    if (word.length > 3 && lowerText.includes(word)) {
      score += 1;
    }
  }

  // Tab-specific heuristics
  if (tabConfig.id === "basketball") {
    const basketballTerms = [
      "game", "score", "team", "player", "coach", "court", ".",
      "shot", "rebound", "assist", "quarter", "timeout", "finals"
    ];
    score += countMatches(lowerText, basketballTerms);
  } else if (tabConfig.id === "politics") {
    const politicalTerms = [
      "government", "bill", "law", "senate", "house", "vote",
      "campaign", "debate", "policy", "minister", "president"
    ];
    score += countMatches(lowerText, politicalTerms);
  } else if (tabConfig.id === "religion") {
    const religiousTerms = [
      "blessed", "pray", "worship", "sacred", "holy",
      "divine", "scripture", "temple", "mosque", "synagogue"
    ];
    score += countMatches(lowerText, religiousTerms);
  }

  const shouldShow = score >= 2;
  return { shouldShow };
}

function countMatches(text, terms) {
  let count = 0;
  for (const term of terms) {
    if (text.includes(term)) count++;
  }
  return count;
}