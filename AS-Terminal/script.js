// Global language setting (default to English)
let currentLanguage = 'us';

// Global variable to track if the application has been initialized
let isInitialized = false;

// Mapping of internal language codes to browser language codes and full names
const languageMapping = {
    'us': { code: 'en', fullName: 'English' },
    'tw': { code: 'zh-TW', fullName: '繁體中文' },
    'th': { code: 'th', fullName: 'ไทย' },
    'pt': { code: 'pt', fullName: 'Português' },
    'kr': { code: 'ko', fullName: '한국어' },
    'jp': { code: 'ja', fullName: '日本語' },
    'idn': { code: 'id', fullName: 'Bahasa Indonesia' },
    'es': { code: 'es', fullName: 'Español' }
};

// Load JSON data
async function loadJson(file) {
    const response = await fetch(file);
    return await response.json();
}

// Get JSON path based on language
function getJsonPath(filename) {
    return `info/${currentLanguage}_${filename}.json`;
}

// Initialize the application
async function init() {
    // Set the current language based on the browser's language only if the application has not been initialized
    if (!isInitialized) {
        const browserLang = navigator.language.slice(0, 2); // Get the first two characters of the browser language
        let matchedLang = Object.keys(languageMapping).find(key => languageMapping[key].code.startsWith(browserLang));
        currentLanguage = matchedLang || 'us';
        isInitialized = true; // Mark the application as initialized
    }

    const pets = await loadJson(getJsonPath('str_pet'));
    const cfg = await loadJson('info/cfg_quest_chat.json');
    displayLanguageButton();
    displaySearchBar(pets, cfg);
    displayPetButtons(pets, cfg, '');
}

// Display search bar
function displaySearchBar(pets, cfg) {
    const container = document.getElementById('searchContainer');
    if (!container) return;
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

            image.onerror = () => { button.textContent = pet.name; };
            button.appendChild(image);
            petButtonsContainer.appendChild(button);
        });
    });
}

// Mapping of language codes to "Navigator" translations
const navigatorTranslations = {
    'us': 'Navigator',
    'tw': '導航員',
    'th': 'ผู้นำทาง',
    'pt': 'Navegador',
    'kr': '조종사',
    'jp': 'ナビゲーター',
    'idn': 'Navigator',
    'es': 'Navegador'
};

// Function to get the translated "Navigator" based on the current language
function getNavigatorTranslation() {
    return navigatorTranslations[currentLanguage] || 'Navigator';
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
    backButton.className = 'button';
    backButton.innerHTML = '<i class="fas fa-arrow-left"></i>'; // Use Font Awesome back arrow
    backButton.onclick = () => { chatButtonsContainer.innerHTML = ''; chatTextContainer.innerHTML = ''; init(); };
    chatButtonsContainer.appendChild(backButton);

    const chatData = await loadJson(getJsonPath('str_quest_chat'));
    const chatData01 = await loadJson(getJsonPath('str_quest_chat01'));

    cfg.forEach((entry) => {
        if (entry.SpeakerID.toString() === petId) {
            const firstWordKey = chatData[`str_quest_chat_${entry.FirstWord}`] ? `str_quest_chat_${entry.FirstWord}` : `str_quest_chat01_${entry.FirstWord}`;
            let buttonText = chatData[firstWordKey] || chatData01[firstWordKey] || 'Chat Text Missing';
            buttonText = buttonText.replace(/PlayerName/gi, getNavigatorTranslation());

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
    const talkData = await loadJson('info/cfg_quest_talk.json');

    chatButtonsContainer.innerHTML = '';

    const backButton = document.createElement('button');
    backButton.className = 'button';
    backButton.innerHTML = '<i class="fas fa-arrow-left"></i>'; // Use Font Awesome back arrow
    backButton.onclick = () => { chatTextContainer.innerHTML = ''; displayChatButtons(petId, cfg); };
    chatButtonsContainer.appendChild(backButton);

    const chatData = await loadJson(getJsonPath('str_quest_chat'));
    const chatData01 = await loadJson(getJsonPath('str_quest_chat01'));
    let currentId = firstWord;
    let incrementing = true;
    let lastAlignment = null;

    while (incrementing) {
        const key = chatData[`str_quest_chat_${currentId}`] ? `str_quest_chat_${currentId}` : `str_quest_chat01_${currentId}`;
        if (chatData[key] || chatData01[key]) {
            let text = chatData[key] || chatData01[key];
            text = text.replace(/<color=#[0-9A-F]{6}>(.*?)<\/color>/gi, '$1');
            text = text.replace(/PlayerName/gi, getNavigatorTranslation());

            const p = document.createElement('p');
            p.textContent = text;

            const talkEntry = talkData.find(entry => entry.ID === currentId);
            const currentAlignment = talkEntry?.IsMainActorWord === 1 ? 'right' : 'left';
            p.style.textAlign = currentAlignment;

            // Add a faint line if the alignment changes
            if (lastAlignment !== null && lastAlignment !== currentAlignment) {
                const hr = document.createElement('hr');
                hr.className = 'faint-line';
                chatTextContainer.appendChild(hr);
            }

            chatTextContainer.appendChild(p);
            lastAlignment = currentAlignment;
            currentId++;
        } else {
            incrementing = false;
        }
    }
}



// Display language button
function displayLanguageButton() {
    let langButton = document.getElementById('languageButton');
    if (!langButton) {
        langButton = document.createElement('button');
        langButton.id = 'languageButton';
        langButton.innerHTML = '<i class="fas fa-globe"></i>'; // Use Font Awesome globe icon
        langButton.className = 'lang-button';
        langButton.onclick = toggleLanguagePicker;
        document.body.appendChild(langButton);
    }
}

// Toggle language picker
function toggleLanguagePicker() {
    let langPicker = document.getElementById('languagePicker');
    if (!langPicker) {
        langPicker = document.createElement('div');
        langPicker.id = 'languagePicker';
        langPicker.className = 'lang-picker';
        
        Object.entries(languageMapping).forEach(([key, { fullName }]) => {
            const button = document.createElement('button');
            button.textContent = fullName;
            button.onclick = () => changeLanguage(key);
            langPicker.appendChild(button);
        });

        document.body.appendChild(langPicker);
    }

    langPicker.classList.toggle('visible');
}

// Change language
function changeLanguage(lang) {
    currentLanguage = lang;
    document.getElementById('languagePicker').classList.remove('visible');

    // Clear chat buttons and chat text
    const chatButtonsContainer = document.getElementById('chatButtons');
    const chatTextContainer = document.getElementById('chatText');
    if (chatButtonsContainer) chatButtonsContainer.innerHTML = '';
    if (chatTextContainer) chatTextContainer.innerHTML = '';

    init();
}


// Start the application
init();
