import zipfile, sys

with zipfile.ZipFile('C:/Users/00/Downloads/b_PwpILvjq8ns.zip', 'r') as z:
    content = z.read('components/sidebar.tsx')
    # Write raw bytes to file
    with open('sidebar_raw.txt', 'wb') as f:
        f.write(content)
    print(f"Written {len(content)} bytes to sidebar_raw.txt")
    # Also try utf-8
    try:
        text = content.decode('utf-8')
        print("UTF-8 decode succeeded")
        print(text)
    except Exception as e:
        print(f"UTF-8 failed: {e}")
        print(content.decode('utf-8', errors='replace'))
