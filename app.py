import os
import json
import logging
from datetime import datetime
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = os.path.join(os.path.dirname(__file__), "releases_cache.json")

def parse_entry_content(entry_html):
    """
    Parses the entry HTML using BeautifulSoup and splits it into individual items
    based on h3 headings (Feature, Deprecated, Issue, Announcement, Changed, etc.)
    """
    soup = BeautifulSoup(entry_html, 'html.parser')
    items = []
    
    # BigQuery release notes group items under <h3> tags
    headings = soup.find_all('h3')
    
    if not headings:
        # Fallback if no h3 elements are found: treat the whole text as a general update
        text_content = soup.get_text().strip()
        items.append({
            'type': 'Update',
            'html': str(soup),
            'text': text_content
        })
        return items
        
    for i, h3 in enumerate(headings):
        item_type = h3.get_text().strip()
        
        # Gather all siblings until the next h3 tag
        sibling_html = []
        sibling = h3.next_sibling
        while sibling and sibling.name != 'h3':
            if sibling.name:
                sibling_html.append(str(sibling))
            elif isinstance(sibling, str) and sibling.strip():
                sibling_html.append(f"<p>{sibling.strip()}</p>")
            sibling = sibling.next_sibling
            
        html_content = "".join(sibling_html)
        temp_soup = BeautifulSoup(html_content, 'html.parser')
        text_content = temp_soup.get_text().strip()
        
        items.append({
            'type': item_type,
            'html': html_content,
            'text': text_content
        })
        
    return items

def fetch_and_parse_feed():
    """
    Fetches the BigQuery RSS XML feed and parses it into structured JSON data.
    """
    logger.info(f"Fetching XML feed from: {FEED_URL}")
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    
    feed = feedparser.parse(response.content)
    
    parsed_updates = []
    
    for entry in feed.entries:
        entry_title = entry.get('title', 'Unknown Date')
        entry_link = entry.get('link', '')
        entry_id = entry.get('id', entry_link)
        entry_updated = entry.get('updated', '')
        
        # HTML content
        summary_html = entry.get('summary', '')
        if not summary_html and entry.get('content'):
            summary_html = entry.content[0].value
            
        # Parse items inside this entry
        sub_items = parse_entry_content(summary_html)
        
        for idx, item in enumerate(sub_items):
            # Formulate a unique ID for each specific update
            item_unique_id = f"{entry_id}_{idx}"
            
            parsed_updates.append({
                'id': item_unique_id,
                'date': entry_title,
                'date_iso': entry_updated,
                'type': item.get('type', 'Update'),
                'html': item.get('html', ''),
                'text': item.get('text', ''),
                'feed_link': entry_link
            })
            
    return {
        'last_updated': datetime.utcnow().isoformat() + "Z",
        'updates': parsed_updates
    }

def get_cached_releases():
    """Reads cached releases if they exist."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading cache file: {e}")
    return None

def write_cached_releases(data):
    """Writes parsed releases data to cache file."""
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error writing cache file: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if not force_refresh:
        cached_data = get_cached_releases()
        if cached_data:
            logger.info("Serving releases from cache.")
            return jsonify(cached_data)
            
    try:
        fresh_data = fetch_and_parse_feed()
        write_cached_releases(fresh_data)
        return jsonify(fresh_data)
    except Exception as e:
        logger.error(f"Failed to retrieve fresh feed: {e}")
        # If fetch fails, try to return cached data as a fallback
        cached_data = get_cached_releases()
        if cached_data:
            logger.info("Returning cached data as fallback after fetch failure.")
            # Tag the response to let the frontend know it's fallback stale data
            cached_data['is_fallback'] = True
            cached_data['error'] = str(e)
            return jsonify(cached_data)
        else:
            return jsonify({
                'error': f"Failed to retrieve feed: {str(e)}",
                'updates': [],
                'last_updated': None
            }), 500

if __name__ == '__main__':
    # Running on localhost port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
