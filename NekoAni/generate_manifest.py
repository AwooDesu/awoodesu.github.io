import os
import json

def generate():
    data = {
        "card": [],
        "sd": [],
        "comic_en": [],
        "comic_jp": []
    }
    
    # Scan Card
    card_path = 'assets/card'
    if os.path.exists(card_path):
        for f in os.listdir(card_path):
            if f.endswith('.skel'):
                basename = f.replace('.skel', '')
                data["card"].append({
                    "id": basename, 
                    "type": "spine", 
                    "skel": f"assets/card/{f}", 
                    "atlas": f"assets/card/{basename}.atlas"
                })
    
    # Scan SD
    sd_path = 'assets/sd'
    if os.path.exists(sd_path):
        for f in os.listdir(sd_path):
            if f.endswith('.skel'):
                basename = f.replace('.skel', '')
                data["sd"].append({
                    "id": basename, 
                    "type": "spine", 
                    "skel": f"assets/sd/{f}", 
                    "atlas": f"assets/sd/{basename}.atlas"
                })

                
    # Scan Comics
    for folder in ['comic_en', 'comic_jp']:
        path = f'assets/{folder}'
        if os.path.exists(path):
            for f in os.listdir(path):
                if f.lower().endswith('.png'):
                    data[folder].append({
                        "id": f.replace('.png', ''), 
                        "type": "image", 
                        "url": f"assets/{folder}/{f}"
                    })

    with open('assets/data.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Generated assets/data.json successfully.")

if __name__ == "__main__":
    generate()
