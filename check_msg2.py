import sqlite3, re
conn = sqlite3.connect('proposal.db')
cur = conn.cursor()
cur.execute("SELECT content FROM messages WHERE id='3627bd5f-1234' OR (conversation_id='449366f8-82f9-480a-9dcf-c3262ad83d00' AND role='assistant') ORDER BY created_at DESC LIMIT 1")
row = cur.fetchone()
if row:
    content = row[0]
    print(f"Total length: {len(content)}")
    print(f"Last 300 chars (raw bytes):")
    print(repr(content[-300:].encode('utf-8', errors='replace')))
    print()
    # Check if ```html opens but there's no closing ```
    idx = content.find('```html')
    if idx >= 0:
        print(f"```html found at position {idx}")
        print(f"Content after ```html (first 100):")
        print(repr(content[idx:idx+100]))
        # Find next ``` after the opening
        rest = content[idx+7:]
        close_idx = rest.find('```')
        print(f"Closing ``` found at: {close_idx} (relative), -1 means not found")
conn.close()
