import sqlite3
conn = sqlite3.connect('proposal.db')
cur = conn.cursor()
cur.execute("SELECT id, role, length(content) FROM messages WHERE conversation_id='449366f8-82f9-480a-9dcf-c3262ad83d00' ORDER BY created_at")
rows = cur.fetchall()
for r in rows:
    mid, role, length = r
    print(f'ID: {mid[:8]}... ROLE: {role} LEN: {length}')
    # Get the tail to check for closing fence
    cur2 = conn.cursor()
    cur2.execute("SELECT substr(content, max(1, length(content)-200)) FROM messages WHERE id=?", (mid,))
    row2 = cur2.fetchone()
    if row2:
        tail = row2[0]
        has_triple = '```' in tail
        print(f'  Has closing ``` in last 200: {has_triple}')
        # Count occurrences of ```html
        cur3 = conn.cursor()
        cur3.execute("SELECT content FROM messages WHERE id=?", (mid,))
        full = cur3.fetchone()
        if full and full[0]:
            content = full[0]
            import re
            blocks = re.findall(r'```html', content, re.IGNORECASE)
            closing = re.findall(r'```\s*$', content, re.MULTILINE)
            print(f'  ```html count: {len(blocks)}, closing ``` at end of lines: {len(closing)}')
            # Try the actual regex
            matches = re.findall(r'```html\s*([\s\S]*?)```', content, re.IGNORECASE)
            print(f'  Full regex matches: {len(matches)}')
            if matches:
                print(f'  First match length: {len(matches[0])}')
    print()
conn.close()
