import feedparser
from bs4 import BeautifulSoup
import json

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_entry_content(entry_html):
    soup = BeautifulSoup(entry_html, 'html.parser')
    items = []
    headings = soup.find_all('h3')
    
    if not headings:
        items.append({
            'type': 'Update',
            'html': str(soup),
            'text': soup.get_text().strip()
        })
        return items
        
    for i, h3 in enumerate(headings):
        item_type = h3.get_text().strip()
        sibling_html = []
        sibling = h3.next_sibling
        while sibling and sibling.name != 'h3':
            if sibling.name:
                sibling_html.append(str(sibling))
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

def main():
    feed = feedparser.parse(FEED_URL)
    print(f"Loaded {len(feed.entries)} entries.")
    
    # Inspect Entry 2 which we know had 4 items
    if len(feed.entries) > 2:
        entry = feed.entries[2]
        print(f"\n--- Parsing Entry 2: {entry.title} ---")
        items = parse_entry_content(entry.summary)
        print(f"Found {len(items)} items:")
        for idx, item in enumerate(items, 1):
            print(f"\nItem {idx}: [{item['type']}]")
            print("HTML Snippet:", item['html'][:150] + "...")
            print("Text Content:", item['text'][:150] + "...")

if __name__ == "__main__":
    main()
