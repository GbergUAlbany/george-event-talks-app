# BigQuery Release Pulse

BigQuery Release Pulse is a modern Flask-based web application that aggregates, parses, and filters BigQuery release notes from the official Google Cloud RSS feed. It splits daily combined digests into individual updates and provides a customized slide-out panel to edit and post updates directly to X (Twitter).

---

## ✨ Features

- **Granular Updates**: Splits combined daily digests from Google Cloud's RSS feed into individual, selectable cards based on update categories.
- **Dynamic Search & Filtering**: Client-side filtering by keywords, titles, or dates, alongside category pills (Features, Announcements, Issues, Changes, Deprecated).
- **Twitter / X Composer**: Slide-out panel pre-populated with auto-formatted tweet text (cropped to fit the 280-character limit with relevant hashtags and source link).
- **Interactive Twitter Mockup**: Live update preview of how the tweet will look in standard dark mode.
- **Smart Caching**: Local caching of feed content (`releases_cache.json`) to bypass network delays, with connection failure fallbacks.

---

## 🛠️ Tech Stack

- **Backend**: Python, Flask, `requests`, `feedparser`, `beautifulsoup4`
- **Frontend**: Vanilla HTML5, Vanilla JavaScript, Vanilla CSS3 (Custom properties, Glassmorphism, animations)
- **Icons**: FontAwesome v6.4

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Python (version 3.10+) installed.

### Setup Instructions

1. **Clone/Navigate to the directory**:
   ```bash
   cd bq-releases-notes
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   - **On Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **On macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the application**:
   ```bash
   python app.py
   ```

6. **Access the dashboard**:
   Open your browser and navigate to **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**.

---

## 📂 Project Structure

```
bq-releases-notes/
├── app.py                     # Flask backend, XML parser & caching
├── requirements.txt           # Python library dependencies
├── README.md                  # Project documentation
├── .gitignore                 # Excluded directories (venv, cache, cache logs)
├── templates/
│   └── index.html             # UI Dashboard structure
└── static/
    ├── css/
    │   └── style.css          # Glassmorphism styling and mockup styles
    └── js/
        └── app.js             # Client orchestration, filter index, tweet limits
```

---

## 🔒 Git Best Practices

The repository includes a configured `.gitignore` that automatically excludes:
- Local python virtual environment directories (`venv/`)
- Compiled Python objects (`__pycache__/`, `*.pyc`)
- Local caches (`releases_cache.json`)
- Local IDE configs (`.vscode/`, `.idea/`)
