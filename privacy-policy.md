# Privacy Policy for Twitter Tabs

**Effective Date:** [10/21/25]

## Introduction
Twitter Tabs is a browser extension that filters your Twitter/X timeline by topics using custom keyword filters. This privacy policy explains how we handle data.

## Data We Access

### Website Content
**What:** The extension accesses tweet text and usernames from your Twitter/X timeline.

**Why:** To filter tweets based on your custom keyword preferences.

**How it's collected:** The extension intercepts Twitter's API responses as they load in your browser, before they're displayed on your screen.

**Is it shared:** No. All filtering happens locally in your browser.

## How It's Used

### Local Content Filtering
When you select a filter (e.g., "Tech News"), the extension:
1. Reads each tweet's text as it loads from Twitter's servers
2. Compares the tweet text against your filter's keywords
3. Shows tweets that match your keywords
4. Hides tweets that don't match
5. Discards the tweet text immediately after filtering (nothing is stored)

### Filter Management
Your custom filters are used to:
- Display available filter options in the dropdown menu
- Apply keyword matching when you select a filter
- Generate new keywords when you create a new filter (if AI generation is enabled)

### AI Keyword Generation (Optional)
If you provide an API key and create a new filter:
1. Your filter name and description are sent to Groq or OpenAI
2. The AI generates 50+ relevant keywords
3. Keywords are returned and stored locally in your browser
4. These keywords are used for future filtering
5. Keywords are cached to avoid regenerating them

**Example:** If you create a filter called "Basketball" with description "NBA, players, games", the AI might generate keywords like: "Lakers", "LeBron", "dunk", "playoff", "MVP", etc.

### Preference Storage
Your preferences are used to:
- Remember which filter you last selected (so it persists when you refresh)
- Display your filter count in the extension popup
- Restore your filtering settings across browser sessions

## Data We Store Locally

The following data is stored **only on your device** using Chrome's local storage:

1. **Custom Filters**
   - Filter names and descriptions you create
   - Keywords associated with each filter (either AI-generated or manually added)

2. **User Preferences**
   - Your last selected filter
   - Timestamp of last filter selection

3. **Optional API Keys** (if you choose to use AI keyword generation)
   - Groq API key or OpenAI API key
   - These are stored locally and never transmitted to us

**Important:** All this data remains on your device. We cannot access it.

## Third-Party Services

If you choose to enable AI keyword generation, the extension will make API calls to:

- **Groq API** (https://groq.com) or
- **OpenAI API** (https://openai.com)

**What's sent:** Only your filter name and description (e.g., "Tech News" - "AI, programming, startups")

**Purpose:** To generate relevant keywords for filtering

**Your API key:** You must provide your own API key. We do not collect, store, or have access to your API keys. They are stored locally in your browser.

## Data We Do NOT Collect

We do not collect, store, or transmit:
- Personal information (name, email, address)
- Authentication credentials (Twitter passwords)
- Browsing history
- User activity (clicks, scrolling)
- Location data
- The actual content of tweets (read and immediately discarded)
- Any data to our servers (we don't have servers)

## Permissions Explained

**Storage Permission:** Required to save your filters and preferences locally on your device.

**Host Permissions (twitter.com, x.com):** Required to:
- Add the filter dropdown to your Twitter timeline
- Read tweet content for filtering
- Apply your selected filter in real-time

## Data Security

All data is stored locally in your browser using Chrome's secure storage API. Since we don't collect or transmit data, there's no risk of data breaches on our end.

## Children's Privacy

This extension is not directed to children under 13. We do not knowingly collect data from children.

## Data Retention

Your filter data is stored locally until you:
- Delete the extension
- Clear your browser data
- Manually delete filters using the extension's "Clear All Data" button

## Your Rights

You have full control over your data:
- View all stored data via the extension popup
- Edit keywords for any filter
- Delete individual filters
- Clear all data using the "Clear All Data" button
- Uninstall the extension to remove all data

## Contact Us

If you have questions about this privacy policy:
- Email: [shankernram@gmail.com]

---

**Summary:** This extension processes Twitter content locally in your browser to filter your timeline. No data is collected or sent to us. Optional AI features require your own API key and send only filter descriptions (not tweet content) to third-party AI services.
