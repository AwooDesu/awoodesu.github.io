// Load JSON data
async function loadJson(file) {
    const response = await fetch(file);
    return await response.json();
}

// Initialize the application
async function init() {
    const pets = await loadJson('us_str_pet.json');
    const cfg = await loadJson('cfg_quest_chat.json');
    displaySearchBar(pets, cfg);
    displayPetButtons(pets, cfg, '');
}

// Display search bar
function displaySearchBar(pets, cfg) {
    const container = document.getElementById('searchContainer');
    if (!container) return; // Prevent error if the container is missing
    container.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search...';
    input.className = 'search-bar';
    input.oninput = () => displayPetButtons(pets, cfg, input.value.toLowerCase());

    container.appendChild(input);
}

// Display pet buttons
async function displayPetButtons(pets, cfg, filter) {
    const petButtonsContainer = document.getElementById('petButtons');
    if (!petButtonsContainer) return;
    petButtonsContainer.innerHTML = '';

    const blacklist = new Set([
        "1400162", "1500122", "1500201", "1500311", "1500341", "1500362", "1500371",
        "1600012", "1600022", "1600031", "1600062", "1600112", "1600252", "1600391",
        "1600431", "1600451", "1701102", "1701103", "1701104", "2900021", "2900141"
    ]);

    const rarityExceptions = {
        "1200501": "3",
        "1501301": "2",
        "1601221": "5",
        "1600041": "3",
        "1600051": "5"
    };

    let petGroups = {};
    Object.keys(pets).forEach(key => {
        if (key.match(/str_pet_name_(\d{7})/)) {
            const id = RegExp.$1;
            let rarity = rarityExceptions[id] || id[1];
            if (!blacklist.has(id)) {
                if (!petGroups[rarity]) {
                    petGroups[rarity] = [];
                }
                petGroups[rarity].push({ id, name: pets[key] });
            }
        }
    });

    const butlerId = "2100118";
    const butlerRarity = "2";
    if (!petGroups[butlerRarity] || !petGroups[butlerRarity].some(pet => pet.id === butlerId)) {
        petGroups[butlerRarity] = petGroups[butlerRarity] || [];
        petGroups[butlerRarity].push({ id: butlerId, name: "Butler" });
    }

    Object.keys(petGroups).sort((a, b) => b.localeCompare(a)).forEach(rarity => {
        petGroups[rarity].sort((a, b) => a.name.localeCompare(b.name));
        petGroups[rarity].forEach(pet => {
            if (filter && !pet.name.toLowerCase().includes(filter)) return;

            const button = document.createElement('button');
            button.className = 'button';
            button.onclick = () => displayChatButtons(pet.id, cfg);

            const image = document.createElement('img');
            const imagePath = `icons/icon_item_${pet.id}_scale.png`;
            image.src = imagePath;
            image.alt = pet.name;

            image.onerror = () => {
                button.textContent = pet.name;
            };

            button.appendChild(image);
            petButtonsContainer.appendChild(button);
        });
    });
}

// Display chat buttons
async function displayChatButtons(petId, cfg) {
    const petButtonsContainer = document.getElementById('petButtons');
    const chatButtonsContainer = document.getElementById('chatButtons');
    const chatTextContainer = document.getElementById('chatText');

    if (!chatButtonsContainer || !chatTextContainer) return;

    petButtonsContainer.innerHTML = '';
    chatButtonsContainer.innerHTML = '';
    chatTextContainer.innerHTML = '';

    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.className = 'button';
    backButton.onclick = () => {
        chatButtonsContainer.innerHTML = '';
        chatTextContainer.innerHTML = '';
        init();
    };
    chatButtonsContainer.appendChild(backButton);

    const chatData = await loadJson('us_str_quest_chat.json');
    const chatData01 = await loadJson('us_str_quest_chat01.json');

    cfg.forEach((entry) => {
        if (entry.SpeakerID.toString() === petId) {
            const firstWordKey = `str_quest_chat_${entry.FirstWord}` in chatData ? `str_quest_chat_${entry.FirstWord}` : `str_quest_chat01_${entry.FirstWord}`;
            let buttonText = chatData[firstWordKey] || chatData01[firstWordKey] || 'Chat Text Missing';

            buttonText = buttonText.replace(/PlayerName/gi, 'Navigator');

            const button = document.createElement('button');
            button.textContent = buttonText;
            button.className = 'chat-button';
            button.onclick = () => displayChatText(entry.FirstWord, cfg, petId);
            chatButtonsContainer.appendChild(button);
        }
    });
}

// Display chat text and manage buttons
async function displayChatText(firstWord, cfg, petId) {
    const chatButtonsContainer = document.getElementById('chatButtons');
    const chatTextContainer = document.getElementById('chatText');
    const talkData = await loadJson('cfg_quest_talk.json');

    // Clear previous buttons
    chatButtonsContainer.innerHTML = '';

    // Display the Back button
    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.className = 'button';
    backButton.onclick = () => {
        chatTextContainer.innerHTML = '';
        displayChatButtons(petId, cfg);
    };
    chatButtonsContainer.appendChild(backButton);

    // Load and display chat text
    const chatData = await loadJson('us_str_quest_chat.json');
    const chatData01 = await loadJson('us_str_quest_chat01.json');
    let currentId = firstWord;
    let incrementing = true;

    while (incrementing) {
        const key = `str_quest_chat_${currentId}` in chatData ? `str_quest_chat_${currentId}` : `str_quest_chat01_${currentId}`;
        if (chatData[key] || chatData01[key]) {
            let text = chatData[key] || chatData01[key];
            text = text.replace(/<color=#[0-9A-F]{6}>(.*?)<\/color>/gi, '$1');
            text = text.replace(/PlayerName/gi, 'Navigator');

            const p = document.createElement('p');
            p.textContent = text;

            // Check alignment from talkData
            const talkEntry = talkData.find(entry => entry.ID === currentId);
            if (talkEntry && talkEntry.IsMainActorWord === 1) {
                p.style.textAlign = 'right';
                p.style.paddingLeft = '20px'; // Add padding to make text more centered from the left border
            } else {
                p.style.textAlign = 'left';
            }

            chatTextContainer.appendChild(p);
            currentId++; // Increment to the next ID
        } else {
            incrementing = false; // Stop if no more consecutive IDs
        }
    }
}



// Start the application
init();
