# Twitter Tabs: Topic-Based Timeline Filter

A powerful Chrome extension that filters your Twitter/X timeline by topics using AI-generated keywords. Create custom filters to see only the content you care about.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![License](https://img.shields.io/badge/license-Apache%202.0-green)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)

## 🎥 Demo

[![Twitter Tabs Demo](icons/web-app-manifest-512x512.png)](https://www.youtube.com/watch?v=B6chD4YoaaA)

Watch Twitter Tabs filter your timeline in real-time with AI-powered topic detection.

## ✨ Features

- **AI-Powered Keyword Generation**: Automatically generates 50+ relevant keywords per topic using Groq or OpenAI
- **Custom Topic Filters**: Create unlimited filters for any topic (sports, tech, news, etc.)
- **Real-Time Filtering**: Intercepts Twitter's API to filter tweets before they reach your screen
- **Dark Mode Support**: Seamlessly integrates with Twitter's dark/light themes
- **Manual Keyword Management**: View, add, edit, and delete keywords for fine-tuned control
- **Smart Caching**: Saves generated keywords locally for instant filtering
- **Zero Performance Impact**: Efficient filtering that doesn't slow down Twitter

## 🚀 Installation

### Chrome Web Store (Coming Soon!)

Twitter Tabs will be available on the Chrome Web Store soon! Once published, you'll be able to install it with a single click directly from the store. Stay tuned for updates!

### From Source (Available Now)

1. **Clone the repository**
```bash
   git clone https://github.com/reknahs/twitter-tabs.git
   cd twitter-tabs
```

2. **Set up API keys** (All free! –– Groq highly recommended because of speed and high token counts)
   - Get a free API key from [Groq](https://console.groq.com/keys) (recommended) or [OpenAI](https://platform.openai.com/api-keys)
   - You'll enter this in the extension popup after installation

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `twitter-tabs` folder

4. **You're ready!** Visit [Twitter](https://twitter.com) or [X.com](https://x.com)

## 📖 Usage

### Creating Your First Filter

1. Click the extension icon in your Chrome toolbar
2. Enter a filter name (e.g., "Tech News")
3. Add a description (e.g., "AI, programming, startups")
4. Click "Generate & Add Filter"
5. Visit Twitter - keywords will be generated automatically

### Applying Filters

1. Go to your Twitter/X home timeline
2. Look for the filter dropdown at the top of your timeline
3. Click to select a filter or "All Tweets" to see everything
4. The page will refresh with your filtered content

### Managing Keywords

1. Open the extension popup
2. Click "View" next to any filter
3. See all generated keywords
4. Add custom keywords manually
5. Delete unwanted keywords
6. Click "Save Changes"

### Note

- If the Twitter algorithm does not have a decent chunk of tweets related to the requested topic, you might notice an increased amount of unrelated tweets for that topic
- This is because if no tweets are found on each search, the extension automatically inserts at least one tweet so infinite scroll can continue
- Because of this, the extension works best if about 10% or more of the timeline tweets are related to the current filter!

## 🏗️ Project Structure
```
twitter-tabs/
├── icons/                          # Extension icons (multiple sizes)
├── inject.js                       # Intercepts Twitter API calls
├── twitter-tabs-content.js         # Main content script & keyword generator
├── twitter-tabs-popup.html         # Extension popup interface
├── twitter-tabs-popup.js           # Popup functionality
├── twitter-tabs-styles.css         # UI styling for dropdown
├── manifest.json                   # Extension configuration
├── LICENSE                         # Apache 2.0 License
└── README.md                       # This file
```

## 🔧 How It Works

### 1. API Interception (`inject.js`)
- Intercepts Twitter's GraphQL API calls using XMLHttpRequest and Fetch overrides
- Filters tweet entries before they render on the page
- Matches tweets against active filter keywords
- Preserves scroll cursors for infinite scrolling

### 2. Keyword Generation (`twitter-tabs-content.js`)
- Uses AI (Groq/OpenAI) to generate 50+ contextually relevant keywords
- Caches keywords locally for performance
- Falls back to local generation if no API key is available
- Automatically generates keywords on first page load

### 3. User Interface
- **Dropdown Menu**: Injected at the top of Twitter's timeline
- **Popup**: Manages filters, API keys, and keywords
- **Modal**: Keyword editor for fine-tuned control

## ⚙️ Configuration

### Supported AI Providers

| Provider | Speed | Cost | Recommended |
|----------|-------|------|-------------|
| **Groq** | ⚡ Very Fast | 🆓 Free | ✅ Yes |
| **OpenAI** | ⚡ Fast | 💰 Paid | Alternative |

### API Key Setup

1. Open the extension popup
2. Select your preferred provider (Groq or OpenAI)
3. Paste your API key
4. Click "Save API Key"

**Note**: API keys are stored locally in Chrome storage and never sent anywhere except the selected AI provider.

## 🛠️ Development

### Prerequisites
- Google Chrome (or Chromium-based browser)
- Text editor (VS Code recommended)
- Basic knowledge of JavaScript and Chrome Extensions

### Key Technologies
- **Manifest V3**: Latest Chrome extension format
- **Content Scripts**: Injected into Twitter pages
- **Chrome Storage API**: Persists filters and keywords
- **Groq/OpenAI APIs**: AI-powered keyword generation

### Debugging

1. **View Extension Logs**
   - Open `chrome://extensions/`
   - Click "background page" or "service worker"
   - Check console for errors

2. **Debug Content Script**
   - Open Twitter/X
   - Press F12 to open DevTools
   - Check Console tab for errors

3. **Inspect Storage**
   - DevTools → Application → Storage → Chrome Extension Storage

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Ideas for Contributions
- Add more AI providers (Anthropic Claude, Gemini, etc.)
- Improve keyword matching algorithm
- Add keyword suggestion features
- Create export/import functionality for filters
- Add statistics/analytics dashboard

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Filter dropdown is disabled on individual tweet pages (by design)
- First-time keyword generation requires internet connection
- Some tweets in threads may be filtered if any tweet matches keywords
- Because the Twitter algorithm requires tweets for infinite scroll, if no relevant tweets are found, one unrelated tweet will be inserted

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/reknahs/twitter-tabs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/reknahs/twitter-tabs/discussions)

## 🙏 Acknowledgments

- Twitter/X for their platform
- Groq for free, fast AI inference
- OpenAI for GPT models
- Chrome Extensions documentation

## ⚠️ Disclaimer

This extension is not affiliated with, endorsed by, or sponsored by Twitter/X Corp. Use at your own discretion. The extension modifies your local view of Twitter content but does not interact with Twitter's servers beyond normal usage.

---

**Made with ❤️ for better Twitter browsing**

⭐ Star this repo if you find it useful!
