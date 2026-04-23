import os
import json

def generate():
    data = {
        "card": [],
        "sd": [],
        "live2d": [],
        "comic_en": [],
        "comic_jp": []
    }

    # Scan Card (Spine)
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

    # Scan SD (Spine)
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

    # Scan Live2D characters
    # Each character is in a subfolder: assets/characters/<id>/<id>.model3.json
    characters_path = 'assets/characters'
    if os.path.exists(characters_path):
        for folder in os.listdir(characters_path):
            folder_path = os.path.join(characters_path, folder)
            if os.path.isdir(folder_path):
                # Look for .model3.json file
                model_file = None
                for f in os.listdir(folder_path):
                    if f.endswith('.model3.json'):
                        model_file = f
                        break

                if model_file:
                    data["live2d"].append({
                        "id": folder,
                        "type": "live2d",
                        "model": f"assets/characters/{folder}/{model_file}"
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

    # Sort all lists by id
    for key in data:
        data[key].sort(key=lambda x: x["id"])

    with open('assets/data.json', 'w') as f:
        json.dump(data, f, indent=2)

    # Print summary
    print("Generated assets/data.json successfully.")
    print(f"  Card:     {len(data['card'])} spine animations")
    print(f"  SD:       {len(data['sd'])} spine animations")
    print(f"  Live2D:   {len(data['live2d'])} characters")
    print(f"  Comic EN: {len(data['comic_en'])} images")
    print(f"  Comic JP: {len(data['comic_jp'])} images")

if __name__ == "__main__":
    generate()
