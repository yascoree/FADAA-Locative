import re

for locale, text in [('fr', 'Mon Abonnement'), ('en', 'Subscription'), ('ar', 'الاشتراك')]:
    path = f'src/locales/{locale}.js'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find agenceSidebar block end and insert abonnement
    # It ends with roleMembre: \"...\",\n    },
    
    # regex to match roleMembre line
    pattern = r'(roleMembre:\s*"[^"]+",)'
    replacement = r'\1\n      abonnement: "' + text + '",'
    
    if 'abonnement:' not in content:
        content = re.sub(pattern, replacement, content)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
