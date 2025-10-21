# Privacy Policy for Twitter Tabs Extension

**Last Updated:** [Current Date]

## Overview
Twitter Tabs is a browser extension that filters your Twitter/X timeline by topics using custom keyword filters.

## Data Collection
This extension does NOT collect, store, or transmit any personal data to external servers.

## Data Processing
The extension processes the following data **locally in your browser only**:
- **Tweet content**: Tweet text is read and filtered based on your custom keywords
- **Filter preferences**: Your custom filter names, descriptions, and keywords
- **API keys** (optional): If you choose to use AI keyword generation, your API keys are stored locally in your browser

## Local Storage
All data is stored locally using Chrome's storage API (`chrome.storage.local`) and remains on your device. This includes:
- Custom filter configurations
- Generated keywords
- Optional API keys (Groq/OpenAI)
- Last selected filter preference

## Third-Party Services
If you choose to enable AI keyword generation, the extension will send requests to:
- **Groq API** or **OpenAI API** (based on your selection)
- These requests only contain your filter name and description to generate relevant keywords
- Your API key is used for authentication but is stored locally and never shared with us

## Data Sharing
We do not share, sell, or transmit any data to third parties. All filtering and processing happens locally in your browser.

## Permissions
The extension requires:
- **Storage**: To save your filter preferences locally
- **Host permissions (twitter.com, x.com)**: To filter your Twitter timeline content

## Changes to Privacy Policy
We may update this privacy policy. Changes will be posted with an updated date.

## Contact
For questions about this privacy policy, please open an issue on our GitHub repository: [Your GitHub URL]
