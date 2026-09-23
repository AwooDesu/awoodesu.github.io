function openTab(evt, tabName) {
    // Check if the tab is disabled
    if (evt.currentTarget.classList.contains('disabled')) {
        return;
    }

    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    // Automatically generate QR when switching to the QR tab to reflect any changes made in other tabs
    if (tabName === 'QR') {
        updateText();
    }
}

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

// Global variable to store translations and character/skin data
let translations = {
    'us': {}
};

// Global variables to store character and skin data
let characterData = {};
let skinData = {};

// Unit tags from game lua (internal_id -> {star, e1, e2, faction, class}); see tools/build_unit_tags.py
let unitTags = {};
// Filter display text per language (element/class/faction names from lua + chrome words);
// see tools/build_filter_lang.py. Falls back to embedded EN if the fetch fails.
let filterLang = {};
const FILTER_FALLBACK_LANG = 'us';
const DEFAULT_FILTER_TEXT = {
    rarity: 'Rarity', class: 'Class', primary: 'Primary', secondary: 'Secondary',
    faction: 'Faction', all: 'All', az: 'A–Z',
    search: 'Search...',
    elements: { 1: 'Water', 2: 'Fire', 3: 'Forest', 4: 'Thunder', 6: 'None' },
    classes: { 2001: 'Converter', 2002: 'Sniper', 2003: 'Detonator', 2004: 'Support' },
    factions: { 1001: 'Lumopolis', 1002: 'Umbraton', 1003: 'Illumina Federation', 1004: 'Northland', 1005: 'Rediesel Wrench', 1006: 'True Order', 1007: 'Independent', 1009: 'Longzhou' }
};

function ft(key) {
    if (filterLang[currentLanguage] && filterLang[currentLanguage][key] != null) return filterLang[currentLanguage][key];
    if (filterLang[FILTER_FALLBACK_LANG] && filterLang[FILTER_FALLBACK_LANG][key] != null) return filterLang[FILTER_FALLBACK_LANG][key];
    return DEFAULT_FILTER_TEXT[key] != null ? DEFAULT_FILTER_TEXT[key] : key;
}

function ftMap(mapName, id) {
    const maps = [filterLang[currentLanguage] && filterLang[currentLanguage][mapName],
        filterLang[FILTER_FALLBACK_LANG] && filterLang[FILTER_FALLBACK_LANG][mapName],
        DEFAULT_FILTER_TEXT[mapName]];
    for (let i = 0; i < maps.length; i++) {
        if (maps[i] && maps[i][id] != null) return maps[i][id];
    }
    return String(id);
}

function elemName(e) { return ftMap('elements', e); }
function clsName(c) { return ftMap('classes', c); }
function factionName(f) { return ftMap('factions', f); }

// Element IDs from cfg_pet_element.lua: 1=Water 2=Fire 3=Forest 4=Thunder 6=No Element (special).
// Display names come from filterLang (lua strings per language). SecondElement 0 = single-element unit.
const ELEMENT_INFO = {
    2: { code: 'FI', color: '#c0392b', icon: 'icons/Fire.webp' },
    1: { code: 'WA', color: '#2980b9', icon: 'icons/Water.webp' },
    3: { code: 'FO', color: '#27ae60', icon: 'icons/Forest.webp' },
    4: { code: 'TH', color: '#b7950b', icon: 'icons/Thunder.webp' },
    6: { code: '--', color: '#616a6b', icon: 'icons/None.webp' }
};
const ELEMENT_ORDER = [2, 1, 3, 4, 6];

// Faction IDs from cfg_pet_tags.lua (Tags[0] in cfg_pet.lua). 1008 Eclipse has no playable units.
const FACTION_INFO = {
    1001: { color: '#f39c12', icon: 'icons/Lumopolis.webp' },
    1002: { color: '#8e44ad', icon: 'icons/Umbraton.webp' },
    1003: { color: '#2980b9', icon: 'icons/Illumina_Federation.webp' },
    1004: { color: '#16a085', icon: 'icons/Northland.webp' },
    1005: { color: '#c0392b', icon: 'icons/Rediesel_Wrench.webp' },
    1006: { color: '#d35400', icon: 'icons/True_Order.webp' },
    1007: { color: '#7f8c8d', icon: 'icons/Independent.webp' },
    1009: { color: '#27ae60', icon: 'icons/Longzhou.webp' }
};
const FACTION_ORDER = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1009];

// Class IDs from Prof in cfg_pet.lua (names from str_pet_tag_job_name_* via filterLang).
const CLASS_INFO = {
    2001: { icon: 'icons/Converter.webp' },
    2002: { icon: 'icons/Sniper.webp' },
    2003: { icon: 'icons/Detonator.webp' },
    2004: { icon: 'icons/Support.webp' }
};
const CLASS_ORDER = [2001, 2002, 2003, 2004];

// Per-unit portrait overrides: served from the dev icons/ folder instead of AS-Terminal.
const UNIT_ICON_OVERRIDE = {
    '1101061': 'icons/Sheol.webp' // Sheol
};

// Active filters. Empty sets = no constraint. pe = primary element, se = secondary element.
const unitFilter = { q: '', rarity: new Set(), pe: new Set(), se: new Set(), cls: new Set(), faction: new Set() };
const skinFilter = { q: '', rarity: new Set(), pe: new Set(), se: new Set(), cls: new Set(), faction: new Set() };

// Sort modes per tab: 'id-asc' (default, lowest on top), 'id-desc', 'alpha-asc', 'alpha-desc'.
let unitSort = 'id-asc';
let skinSort = 'id-asc';

function terminalIconPath(internalId) {
    if (UNIT_ICON_OVERRIDE[internalId]) return UNIT_ICON_OVERRIDE[internalId];
    return '../AS-Terminal/icons/icon_item_' + internalId + '_scale.png';
}

// Tag lookup with fallback: rarity from 2nd digit of internal ID (AS-Terminal convention),
// element/faction/class unknown when the unit is missing from unit_tags.json.
function getUnitTag(internalId) {
    const tag = unitTags[internalId];
    if (tag) return { star: tag.star, e1: tag.e1, e2: tag.e2, faction: tag.faction, cls: tag.class, unknown: false };
    const fallbackStar = parseInt((internalId || '').charAt(1), 10);
    return { star: isNaN(fallbackStar) ? 0 : fallbackStar, e1: null, e2: null, faction: null, cls: null, unknown: true };
}

// Global variable to track QR style (default or FT)
let useFTStyle = true;

// Track UNKNOWN positions for T/F format
let unitUnknownPositions = new Set();
let skinUnknownPositions = new Set();

// Flag to track if QR has been generated at least once
let qrGenerated = false;

let availableImages = [];
let currentChibis = [];
let nextChibis = [];
let isNameVisible = true;
let isIDVisible = true;

let imageCache = new Map(); // path -> Promise<string | null>

function preloadImage(path) {
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }
    const promise = fetch(path)
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.blob();
        })
        .then(blob => URL.createObjectURL(blob))
        .catch(e => {
            console.warn("Failed to fetch image blob:", path, e);
            imageCache.delete(path);
            return null;
        });
    imageCache.set(path, promise);
    return promise;
}

function createImageFromUrl(url) {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function loadImages() {
    try {
        preloadImage('png/astra_project.png'); // Eager preload for faster startup
        const response = await fetch(`./images.json?v=${Date.now()}`);
        if (response.ok) {
            availableImages = await response.json();
            // Initial selection of 12 images (6 for current, 6 for next)
            await refreshPicturePools(true);
        }
    } catch (e) {
        console.error("Failed to load images.json:", e);
    }
}

async function refreshPicturePools(isInitial = false) {
    const pool = availableImages.filter(p => !p.includes('astra_project'));
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    
    if (isInitial) {
        currentChibis = shuffled.slice(0, 7); // Pick up to 7 in case both name/ID are hidden
        nextChibis = shuffled.slice(7, 14);
    } else {
        // Move next to current
        currentChibis = [...nextChibis];
        // Preload 7 more into next
        nextChibis = shuffled.slice(0, 7);
    }
    // Eagerly preload all images so they are fully loaded by the time QR generates
    [...currentChibis, ...nextChibis].forEach(path => preloadImage(path));
}

function toggleNameVisibility() {
    isNameVisible = !isNameVisible;
    const btn = document.getElementById('toggleNameBtn');
    if (isNameVisible) {
        btn.textContent = t('hide_name');
    } else {
        btn.textContent = t('show_name');
    }
    updateText();
}

function toggleIDVisibility() {
    isIDVisible = !isIDVisible;
    const btn = document.getElementById('toggleIDBtn');
    if (isIDVisible) {
        btn.textContent = t('hide_id');
    } else {
        btn.textContent = t('show_id');
    }
    updateText();
}

async function rerollPictures() {
    await refreshPicturePools(false);
    updateText();
}

async function assembleQRWithExtras(qrDataURL, username, userId) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const qrImg = new Image();
        
        qrImg.onload = async () => {
            const qrSize = qrImg.width;
            const topImgUrl = await preloadImage('png/astra_project.png');
            const topImg = await createImageFromUrl(topImgUrl);
            
            const topHeight = (topImg && topImg.height) ? (topImg.height / topImg.width) * qrSize : 0;
            const extraBottomHeight = 120;
            const totalContentHeight = topHeight + qrSize + extraBottomHeight;

            // Make it a square by using the larger dimension
            const finalSize = Math.max(qrSize, totalContentHeight);
            canvas.width = finalSize;
            canvas.height = finalSize;
            
            // Calculate offsets to center content
            const xOffset = (finalSize - qrSize) / 2;
            const yOffset = (finalSize - totalContentHeight) / 2;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw top image if it loaded
            if (topImg && topImg.height) {
                ctx.drawImage(topImg, xOffset, yOffset, qrSize, topHeight);
            }
            
            // Draw QR
            ctx.drawImage(qrImg, xOffset, yOffset + topHeight);
            
            const drawImage = async (path, x, y) => {
                const objectUrl = await preloadImage(path);
                const img = await createImageFromUrl(objectUrl);
                if (!img || img.width === 0 || img.height === 0) return; // If failed, just skip safely

                ctx.save();
                ctx.globalAlpha = 0.95;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Use a subtle blur to "soften" the jaggies
                ctx.filter = 'blur(0.3px)';
                
                // Stepped downscaling for better quality
                let tempCanvas = document.createElement('canvas');
                let tempCtx = tempCanvas.getContext('2d');
                let w = img.width;
                let h = img.height;
                
                tempCanvas.width = w;
                tempCanvas.height = h;
                tempCtx.drawImage(img, 0, 0);
                
                // Step down to avoid aliasing
                while (w > 200) {
                    const nextW = Math.floor(w / 2);
                    const nextH = Math.floor(h / 2);
                    const nextCanvas = document.createElement('canvas');
                    const nextCtx = nextCanvas.getContext('2d');
                    nextCanvas.width = nextW;
                    nextCanvas.height = nextH;
                    nextCtx.imageSmoothingEnabled = true;
                    nextCtx.imageSmoothingQuality = 'high';
                    nextCtx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, nextW, nextH);
                    tempCanvas = nextCanvas;
                    w = nextW;
                    h = nextH;
                }
                
                ctx.drawImage(tempCanvas, 0, 0, w, h, x, y, 100, 100);
                ctx.restore();
            };
            
            // Use pre-selected unique chibis from the pool
            let chibiIndex = 0;
            const getUniqueImg = () => currentChibis[chibiIndex++] || currentChibis[0];
            
            // Bottom Corners
            await drawImage(getUniqueImg(), 10, finalSize - 110);
            await drawImage(getUniqueImg(), finalSize - 110, finalSize - 110);
            
            // Top Corners
            await drawImage(getUniqueImg(), 10, 10);
            await drawImage(getUniqueImg(), finalSize - 110, 10);
            
            // Mid Sides
            const midY = (finalSize / 2) - 50;
            await drawImage(getUniqueImg(), 10, midY);
            await drawImage(getUniqueImg(), finalSize - 110, midY);
            
            const bottomStart = yOffset + topHeight + qrSize;
            const footerCenterY = bottomStart + 60;
            
            // Draw Decorations (Name/ID)
            if (!isNameVisible && !isIDVisible) {
                // If both hidden, add a 7th chibi in the center
                await drawImage(getUniqueImg(), (finalSize / 2) - 50, bottomStart + 10);
            } else {
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const maxTextWidth = finalSize - 240;

                if (isNameVisible && isIDVisible) {
                    // Draw Name (Top) - Increased size further
                    let nameFontSize = 52;
                    ctx.font = `700 ${nameFontSize}px "Cinzel"`;
                    let nameMetrics = ctx.measureText(username);
                    if (nameMetrics.width > maxTextWidth) {
                        nameFontSize = Math.floor(nameFontSize * (maxTextWidth / nameMetrics.width));
                        ctx.font = `700 ${nameFontSize}px "Cinzel"`;
                    }
                    ctx.fillText(username, finalSize / 2, footerCenterY - 24);

                    // Draw ID (Bottom) - Increased size further (+10%)
                    let idFontSize = 24;
                    ctx.font = `400 ${idFontSize}px "Cinzel"`;
                    ctx.fillText(`ID: ${userId}`, finalSize / 2, footerCenterY + 30);
                } else if (isNameVisible) {
                    // Draw Only Name (Centered) - Increased size further (+10%)
                    let fontSize = 57;
                    ctx.font = `700 ${fontSize}px "Cinzel"`;
                    let metrics = ctx.measureText(username);
                    if (metrics.width > maxTextWidth) {
                        fontSize = Math.floor(fontSize * (maxTextWidth / metrics.width));
                    } else if (metrics.width < maxTextWidth * 0.8) {
                        fontSize = Math.min(88, Math.floor(fontSize * (maxTextWidth / metrics.width) * 0.9));
                    }
                    ctx.font = `700 ${fontSize}px "Cinzel"`;
                    ctx.fillText(username, finalSize / 2, footerCenterY);
                } else if (isIDVisible) {
                    // Draw Only ID (Centered) - Increased size further (+10%)
                    let fontSize = 44;
                    ctx.font = `400 ${fontSize}px "Cinzel"`;
                    ctx.fillText(`ID: ${userId}`, finalSize / 2, footerCenterY);
                }
            }
            
            resolve(canvas.toDataURL('image/png'));
        };
        qrImg.src = qrDataURL;
    });
}

// Get the current state of checkboxes in a container
function getCheckboxStates(containerId) {
    const checkboxes = document.getElementById(containerId).querySelectorAll("input[type='checkbox']");
    return Array.from(checkboxes).map(checkbox => ({
        value: checkbox.value,
        checked: checkbox.checked
    }));
}

// Set the state of checkboxes in a container
function setCheckboxStates(containerId, states) {
    if (!states || !Array.isArray(states)) return;

    const checkboxes = document.getElementById(containerId).querySelectorAll("input[type='checkbox']");
    const stateMap = new Map(states.map(state => [state.value, state.checked]));

    checkboxes.forEach(checkbox => {
        if (stateMap.has(checkbox.value)) {
            checkbox.checked = stateMap.get(checkbox.value);
        }
    });
}

// Get JSON path based on language
function getJsonPath() {
    // This function is no longer needed as we're now using internal translations
    // Keeping it for backward compatibility
    return '';
}

// Load translation file from JSON and character/skin data
async function loadTranslations() {
    try {
        // Load character and skin data first
        const [charResponse, skinResponse] = await Promise.all([
            fetch('all_ID.json').then(res => res.json()),
            fetch('all_skin.json').then(res => res.json())
        ]);

        characterData = await charResponse;
        skinData = await skinResponse;

        // Unit tags (rarity/element/faction/class from game lua). Non-fatal: fallbacks apply if missing.
        try {
            const tagResponse = await fetch('unit_tags.json');
            if (tagResponse.ok) {
                unitTags = await tagResponse.json();
            }
        } catch (e) {
            console.warn('unit_tags.json not loaded, using fallback tags:', e);
        }

        // Filter display text per language (names from lua + chrome words). Non-fatal: embedded EN applies.
        try {
            const langResponse = await fetch('filter_lang.json');
            if (langResponse.ok) {
                filterLang = await langResponse.json();
            }
        } catch (e) {
            console.warn('filter_lang.json not loaded, using embedded English:', e);
        }

        // Now load UI translations if needed
        try {
            const response = await fetch(`./lang/${currentLanguage}.json?v=${Date.now()}`);
            if (response.ok) {
                translations[currentLanguage] = await response.json();
            } else if (currentLanguage !== 'us') {
                // Fallback to English if the requested language doesn't exist
                currentLanguage = 'us';
                const enResponse = await fetch(`./lang/us.json?v=${Date.now()}`);
                if (enResponse.ok) {
                    translations['us'] = await enResponse.json();
                }
            }
        } catch (e) {
            console.error('Error loading UI translations:', e);
            if (currentLanguage !== 'us' && !translations['us']) {
                try {
                    const enResponse = await fetch(`./lang/us.json?v=${Date.now()}`);
                    if (enResponse.ok) {
                        translations['us'] = await enResponse.json();
                        currentLanguage = 'us';
                    }
                } catch (innerError) {
                    console.error('Error loading fallback translations:', innerError);
                }
            }
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Get translation for a given key
function t(key) {
    // Try to get the translation for the current language
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
        return translations[currentLanguage][key];
    }

    // Fall back to English if the key is not found in the current language
    if (currentLanguage !== 'us' && translations['us'] && translations['us'][key]) {
        return translations['us'][key];
    }

    // If the key is not found in either language, return the key as a fallback
    return key;
}

function resizeLanguageSelector() {
    const sel = document.getElementById('languageSelector');
    if (!sel) return;
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.font = window.getComputedStyle(sel).font;
    tempSpan.textContent = sel.options[sel.selectedIndex].text;
    document.body.appendChild(tempSpan);
    // Add some padding for the arrow/dropdown icon space
    sel.style.width = (tempSpan.getBoundingClientRect().width + 25) + 'px';
    document.body.removeChild(tempSpan);
}

// Set the current language based on the browser's language
function detectAndSetLanguage() {
    if (!isInitialized) {
        const browserLang = navigator.language.slice(0, 2); // Get the first two characters of the browser language
        let matchedLang = Object.keys(languageMapping).find(key => languageMapping[key].code.startsWith(browserLang));
        currentLanguage = matchedLang || 'us';
        isInitialized = true; // Mark the application as initialized
    }
}

function validateID() {
    const idInput = document.getElementById('idInput');
    let val = idInput.value.replace(/[^0-9]/g, '');
    
    if (val === '') {
        val = '1';
    } else {
        let num = Number(val);
        if (num <= 0) {
            val = '1';
        } else if (num > 9007199254740991) {
            val = '9007199254740991';
        }
    }
    
    if (idInput.value !== val) {
        idInput.value = val;
    }
}

let qrDebounceTimer = null;

function updateText() {
    validateID();
    let unitOutput = [];
    let skinOutput = [];
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    const skinCheckboxes = document.getElementById('checkboxesTab2').querySelectorAll("input[type='checkbox']");
    const idValue = document.getElementById('idInput').value;
    const username = document.getElementById('usernameInput').value;

    if (useFTStyle) {
        // T/F Style
        const unitTF = buildTFSequence(unitCheckboxes, unitUnknownPositions);
        const skinTF = buildTFSequence(skinCheckboxes, skinUnknownPositions);
        document.getElementById("output").value = unitTF + '|' + skinTF + '|' + idValue + '|' + username;
    } else {
        // Standard (Numerical) Style
        unitCheckboxes.forEach((checkbox) => {
            if (checkbox.checked) unitOutput.push(checkbox.value);
        });
        skinCheckboxes.forEach((checkbox) => {
            if (checkbox.checked) skinOutput.push(checkbox.value);
        });
        document.getElementById("output").value = unitOutput.join(',') + '|' + skinOutput.join(',') + '|' + idValue + '|' + username;
    }

    // Only trigger QR preview generation if the QR tab is active, using debounce to save performance
    if (document.getElementById('QR').style.display === 'block') {
        clearTimeout(qrDebounceTimer);
        qrDebounceTimer = setTimeout(() => {
            generateQRPreview();
        }, 150);
    }
}

function generateQRPreview() {
    qrGenerated = true;
    const inputText = document.getElementById('output').value;
    const username = document.getElementById('usernameInput').value.trim() || 'user';
    const userId = document.getElementById('idInput').value.trim() || '0';
    let qrOptions = { errorCorrectionLevel: 'M', width: 400 };

    QRCode.toDataURL(inputText, qrOptions, async function (error, url) {
        if (!error) {
            const finalUrl = await assembleQRWithExtras(url, username, userId);
            const qrImage = document.getElementById('qrImage');
            const wrapper = document.getElementById('qrDownloadWrapper');
            
            const safeUsername = username.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            const safeUserId = userId.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            const filename = `QRCode-${safeUsername}-${safeUserId}.png`;
            
            // Convert DataURL to a File object with a name to help browser naming on right-click
            const response = await fetch(finalUrl);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: 'image/png' });
            const blobUrl = URL.createObjectURL(file);
            
            // Clean up old blob URLs to prevent memory leaks
            if (qrImage.src && qrImage.src.startsWith('blob:')) {
                URL.revokeObjectURL(qrImage.src);
            }
            
            qrImage.src = blobUrl;
            qrImage.alt = filename;
            qrImage.title = filename; // Some browsers use title as filename hint
            
            if (wrapper) {
                wrapper.href = blobUrl;
                wrapper.download = filename;
                wrapper.style.display = 'block';
            }
            qrImage.style.display = 'block';
        } else {
            const qrImage = document.getElementById('qrImage');
            const wrapper = document.getElementById('qrDownloadWrapper');
            if (qrImage) qrImage.style.display = 'none';
            if (wrapper) wrapper.style.display = 'none';
        }
    });
}

function buildTFSequence(checkboxes, unknownPositions) {
    let result = [];
    let checkboxIndex = 0;

    // Find the maximum ID to determine sequence length
    let maxId = 0;
    checkboxes.forEach((checkbox) => {
        const id = parseInt(checkbox.value);
        if (id > maxId) maxId = id;
    });

    // Also check unknown positions for max
    unknownPositions.forEach(pos => {
        if (pos > maxId) maxId = pos;
    });

    // Build sequence from 1 to maxId
    for (let i = 1; i <= maxId; i++) {
        if (unknownPositions.has(i)) {
            // UNKNOWN position = F
            result.push('F');
        } else {
            // Check if this ID exists in checkboxes
            const checkbox = Array.from(checkboxes).find(cb => parseInt(cb.value) === i);
            if (checkbox) {
                result.push(checkbox.checked ? 'T' : 'F');
            } else {
                // ID doesn't exist (gap in sequence) = F
                result.push('F');
            }
        }
    }

    return result.join('');
}

function loadCheckboxes() {
    // Clear existing checkboxes
    document.getElementById('checkboxesTab1').innerHTML = '';
    document.getElementById('checkboxesTab2').innerHTML = '';

    // Load characters
    if (characterData && characterData.characters) {
        const tab1 = document.getElementById('checkboxesTab1');
        populateCharacterCheckboxes(tab1, unitUnknownPositions);
    }

    // Load skins
    if (skinData && skinData.skins) {
        const tab2 = document.getElementById('checkboxesTab2');
        populateSkinCheckboxes(tab2, skinUnknownPositions);
    }

    // Re-apply saved sort order, then active search/filters without animation
    // (preserves them across language switches)
    sortUnitItems();
    sortSkinCards();
    applyUnitFilter(false);
    applySkinFilter(false);

    updateText();
}

function toggleGroupCheckboxes(groupDiv, itemClass) {
    const boxes = Array.from(groupDiv.querySelectorAll('.' + itemClass + ' input[type="checkbox"]'));
    const visible = boxes.filter(cb => !cb.closest('.' + itemClass).classList.contains('hidden'));
    const targets = visible.length ? visible : boxes;
    const allChecked = targets.every(cb => cb.checked);
    targets.forEach(cb => { cb.checked = !allChecked; });
    updateText();
}

// Rarity section header: a row of shrunk star icons, no text.
function appendStarIcons(header, star) {
    const n = Math.min(Math.max(star, 0), 6);
    for (let i = 0; i < n; i++) {
        const im = document.createElement('img');
        im.className = 'star-icon';
        im.src = 'icons/star.webp';
        im.alt = star + ' star';
        header.appendChild(im);
    }
}

function populateCharacterCheckboxes(container, unknownSet) {
    const characters = Object.values(characterData.characters);
    const entries = [];

    characters.forEach(character => {
        const id = character.qr_id;
        const name = character.names ? (character.names[currentLanguage] || character.names['us'] || 'UNKNOWN') : 'UNKNOWN';

        if (name === 'UNKNOWN') {
            unknownSet.add(parseInt(id));
            return;
        }

        const internalId = character.internal_id;
        entries.push({
            qrId: id,
            internalId: internalId,
            name: name,
            usName: (character.names && character.names['us']) || name,
            tag: getUnitTag(internalId)
        });
    });

    // Sort: rarity (star) descending, then name, then QR id
    entries.sort((a, b) => (b.tag.star - a.tag.star) || a.name.localeCompare(b.name) || (parseInt(a.qrId) - parseInt(b.qrId)));

    let currentStar = null;
    let groupItems = null;
    entries.forEach(entry => {
        if (entry.tag.star !== currentStar) {
            currentStar = entry.tag.star;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'rarity-group';
            groupDiv.dataset.star = String(currentStar);

            const header = document.createElement('div');
            header.className = 'group-header';
            header.title = 'Click to toggle all units in this group';
            if (currentStar > 0) appendStarIcons(header, currentStar);
            else header.textContent = '? Unknown';
            header.onclick = () => toggleGroupCheckboxes(groupDiv, 'unit-item');
            groupDiv.appendChild(header);

            groupItems = document.createElement('div');
            groupItems.className = 'group-items';
            groupDiv.appendChild(groupItems);
            container.appendChild(groupDiv);
        }
        groupItems.appendChild(createUnitCheckbox(entry));
    });
}

function createUnitCheckbox(entry) {
    const label = document.createElement('label');
    label.className = 'unit-item';
    label.dataset.star = String(entry.tag.star);
    label.dataset.e1 = String(entry.tag.e1);
    label.dataset.e2 = String(entry.tag.e2);
    label.dataset.cls = String(entry.tag.cls);
    label.dataset.faction = String(entry.tag.faction);
    label.dataset.qr = String(entry.qrId);
    label.dataset.dname = entry.name;
    label.dataset.name = (entry.name + ' ' + entry.usName + ' ' + entry.qrId).toLowerCase();

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = entry.qrId;
    checkbox.onchange = updateText;
    checkbox.checked = true;
    label.appendChild(checkbox);

    const img = document.createElement('img');
    img.className = 'unit-icon';
    img.src = terminalIconPath(entry.internalId);
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; };
    label.appendChild(img);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'unit-name';
    nameSpan.textContent = entry.name;
    label.appendChild(nameSpan);

    const faction = FACTION_INFO[entry.tag.faction];
    const cls = CLASS_INFO[entry.tag.cls];
    const e1Name = ELEMENT_INFO[entry.tag.e1] ? elemName(entry.tag.e1) : '?';
    const e2Name = entry.tag.e2 === 0 ? 'Single' : (ELEMENT_INFO[entry.tag.e2] ? elemName(entry.tag.e2) : '?');
    label.title = entry.name + ' | ' + entry.tag.star + '★ | ' + (cls ? clsName(entry.tag.cls) : '?') + ' | ' + e1Name + '/' + e2Name + ' | ' + (faction ? factionName(entry.tag.faction) : '?');
    return label;
}

function populateSkinCheckboxes(container, unknownSet) {
    // Map US unit name -> character, so each skin inherits its unit's tags + portrait
    const usToUnit = {};
    Object.values(characterData.characters || {}).forEach(character => {
        const us = character.names && character.names['us'];
        if (us && us !== 'UNKNOWN') usToUnit[us] = character;
    });

    const groups = {};
    skinData.skins.forEach(skin => {
        const id = skin.id;
        const usName = skin.names ? (skin.names['us'] || '') : '';
        const name = skin.names ? (skin.names[currentLanguage] || skin.names['us'] || ('UNKNOWN-' + id)) : ('UNKNOWN-' + id);

        if (name.startsWith('UNKNOWN') || usName.startsWith('UNKNOWN')) {
            unknownSet.add(parseInt(id));
            return;
        }

        const prefix = usName.indexOf('-') >= 0 ? usName.slice(0, usName.lastIndexOf('-')) : usName;
        const unit = usToUnit[prefix];
        const internalId = unit ? unit.internal_id : null;
        const tag = unit ? getUnitTag(internalId) : { star: 0, e1: null, e2: null, faction: null, cls: null, unknown: true };
        const unitName = unit ? (unit.names[currentLanguage] || unit.names['us']) : prefix;
        const key = internalId || ('noid_' + prefix);
        if (!groups[key]) groups[key] = { internalId: internalId, unitName: unitName, unitQr: unit ? unit.qr_id : '0', tag: tag, skins: [] };
        groups[key].skins.push({ id: id, name: name, usName: usName });
    });

    // Rarity sections (top-down like the unit tab), unit cards inside sorted alphabetically.
    const byStar = {};
    Object.values(groups).forEach(group => {
        const star = group.tag.star;
        if (!byStar[star]) byStar[star] = [];
        byStar[star].push(group);
    });
    Object.keys(byStar).map(Number).sort((a, b) => b - a).forEach(star => {
        const section = document.createElement('div');
        section.className = 'rarity-group';
        section.dataset.star = String(star);

        const header = document.createElement('div');
        header.className = 'group-header';
        header.title = 'Click to toggle all skins in this group';
        if (star > 0) appendStarIcons(header, star);
        else header.textContent = '? Unknown';
        header.onclick = () => toggleGroupCheckboxes(section, 'skin-item');
        section.appendChild(header);

        const cards = document.createElement('div');
        cards.className = 'skin-cards';
        section.appendChild(cards);

        byStar[star]
            .sort((a, b) => a.unitName.localeCompare(b.unitName))
            .forEach(group => {
                group.skins.sort((a, b) => parseInt(a.id) - parseInt(b.id));

                const groupDiv = document.createElement('div');
                groupDiv.className = 'skin-unit-group';
                groupDiv.dataset.uqr = String(group.unitQr);
                groupDiv.dataset.uname = group.unitName;

                // Big portrait on the left; click toggles the whole group. One icon per group.
                if (group.internalId) {
                    const portrait = document.createElement('img');
                    portrait.className = 'skin-unit-portrait';
                    portrait.src = terminalIconPath(group.internalId);
                    portrait.alt = group.unitName;
                    portrait.loading = 'lazy';
                    portrait.title = group.unitName + ' — click to toggle all skins in this group';
                    portrait.onerror = () => { portrait.style.display = 'none'; };
                    portrait.onclick = () => toggleGroupCheckboxes(groupDiv, 'skin-item');
                    groupDiv.appendChild(portrait);
                }

                const list = document.createElement('div');
                list.className = 'skin-unit-list';
                group.skins.forEach(skin => list.appendChild(createSkinCheckbox(skin, group)));
                groupDiv.appendChild(list);
                cards.appendChild(groupDiv);
            });

        container.appendChild(section);
    });
}

function createSkinCheckbox(skin, group) {
    const label = document.createElement('label');
    label.className = 'skin-item';
    label.dataset.star = String(group.tag.star);
    label.dataset.e1 = String(group.tag.e1);
    label.dataset.e2 = String(group.tag.e2);
    label.dataset.cls = String(group.tag.cls);
    label.dataset.faction = String(group.tag.faction);
    label.dataset.dname = skin.name;
    label.dataset.name = (skin.name + ' ' + skin.usName + ' ' + group.unitName).toLowerCase();

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = skin.id;
    checkbox.onchange = updateText;
    checkbox.checked = true;
    label.appendChild(checkbox);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'unit-name';
    nameSpan.textContent = skin.name;
    label.appendChild(nameSpan);

    const e1Name = ELEMENT_INFO[group.tag.e1] ? elemName(group.tag.e1) : '?';
    const e2Name = group.tag.e2 === 0 ? 'Single' : (ELEMENT_INFO[group.tag.e2] ? elemName(group.tag.e2) : '?');
    label.title = skin.name + ' | ' + group.tag.star + '★ | ' + e1Name + '/' + e2Name;
    return label;
}

// ---------- Search + quick filters with FLIP animation ----------

// Shared predicate for DOM items. `ignore` skips one filter category.
function entryMatches(entry, filter, ignore) {
    if (filter.q && entry.hay.indexOf(filter.q) < 0) return false;
    if (ignore !== 'rarity' && filter.rarity.size > 0 && !filter.rarity.has(String(entry.star))) return false;
    if (ignore !== 'pe' && filter.pe.size > 0) {
        if (entry.e1 == null) return false;
        let ok = false;
        filter.pe.forEach(e => { if (entry.e1 === Number(e)) ok = true; });
        if (!ok) return false;
    }
    if (ignore !== 'se' && filter.se.size > 0) {
        if (entry.e2 == null) return false;
        let ok = false;
        filter.se.forEach(e => { if (entry.e2 === Number(e)) ok = true; });
        if (!ok) return false;
    }
    if (ignore !== 'cls' && filter.cls.size > 0 && !filter.cls.has(String(entry.cls))) return false;
    if (ignore !== 'faction' && filter.faction.size > 0 && !filter.faction.has(String(entry.faction))) return false;
    return true;
}

function datasetEntry(ds) {
    const num = v => (v === 'null' || v === 'undefined' || v == null || v === '') ? null : Number(v);
    return { star: Number(ds.star), e1: num(ds.e1), e2: num(ds.e2), cls: num(ds.cls), faction: ds.faction, hay: ds.name || '' };
}

function itemMatches(el, filter) {
    return entryMatches(datasetEntry(el.dataset), filter, null);
}

function applyItemFilter(containerId, itemClass, filter, animate) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.' + itemClass));

    // First: record positions of currently visible items
    const first = new Map();
    if (animate) {
        items.forEach(el => {
            if (!el.classList.contains('hidden')) first.set(el, el.getBoundingClientRect());
        });
    }

    // Mutate: show/hide items, hide emptied groups
    items.forEach(el => el.classList.toggle('hidden', !itemMatches(el, filter)));
    container.querySelectorAll('.rarity-group, .skin-unit-group').forEach(g => {
        const anyVisible = Array.from(g.querySelectorAll('.' + itemClass)).some(el => !el.classList.contains('hidden'));
        g.classList.toggle('hidden', !anyVisible);
    });

    if (!animate) return;

    // Last/Invert/Play: glide surviving items to their new spots, pop in newcomers
    items.forEach(el => {
        if (el.classList.contains('hidden')) return;
        const f = first.get(el);
        const l = el.getBoundingClientRect();
        if (!f) {
            el.animate(
                [{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'scale(1)' }],
                { duration: 200, easing: 'ease-out' }
            );
        } else {
            const dx = f.left - l.left;
            const dy = f.top - l.top;
            if (dx || dy) {
                el.animate(
                    [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }],
                    { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' }
                );
            }
        }
    });
}

function applyUnitFilter(animate) {
    applyItemFilter('checkboxesTab1', 'unit-item', unitFilter, animate !== false);
}

function applySkinFilter(animate) {
    applyItemFilter('checkboxesTab2', 'skin-item', skinFilter, animate !== false);
}

// ---------- Sorting (reorders DOM in place, checkbox states preserved) ----------

function sortUnitItems() {
    const desc = unitSort.endsWith('desc');
    const byId = unitSort.startsWith('id');
    const container = document.getElementById('checkboxesTab1');
    if (!container) return;
    Array.from(container.querySelectorAll('.group-items')).forEach(gr => {
        const rows = Array.from(gr.querySelectorAll('.unit-item'));
        rows.sort((a, b) => {
            let r;
            if (byId) r = Number(a.dataset.qr) - Number(b.dataset.qr);
            else r = (a.dataset.dname || '').localeCompare(b.dataset.dname || '');
            return desc ? -r : r;
        });
        rows.forEach(r => gr.appendChild(r));
    });
}

function sortSkinCards() {
    const desc = skinSort.endsWith('desc');
    const byId = skinSort.startsWith('id');
    const container = document.getElementById('checkboxesTab2');
    if (!container) return;
    Array.from(container.querySelectorAll('.rarity-group')).forEach(sec => {
        const grids = sec.querySelectorAll('.skin-cards');
        if (!grids.length) return;
        const grid = grids[0];
        const cards = Array.from(grid.querySelectorAll('.skin-unit-group'));
        cards.sort((a, b) => {
            let r;
            if (byId) r = Number(a.dataset.uqr) - Number(b.dataset.uqr);
            else r = (a.dataset.uname || '').localeCompare(b.dataset.uname || '');
            return desc ? -r : r;
        });
        cards.forEach(c => {
            const lists = c.querySelectorAll('.skin-unit-list');
            if (lists.length) {
                const rows = Array.from(lists[0].querySelectorAll('.skin-item'));
                rows.sort((x, y) => {
                    let r;
                    if (byId) r = Number(x.querySelectorAll('input')[0].value) - Number(y.querySelectorAll('input')[0].value);
                    else r = (x.dataset.dname || '').localeCompare(y.dataset.dname || '');
                    return desc ? -r : r;
                });
                rows.forEach(r => lists[0].appendChild(r));
            }
            grid.appendChild(c);
        });
    });
}

function setSortBtn(id, label, active, desc) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = label + (active ? (desc ? ' ↓' : ' ↑') : '');
    btn.classList.toggle('active', active);
}

function updateSortButtons() {
    setSortBtn('unitSortId', 'ID', unitSort.startsWith('id'), unitSort.endsWith('desc'));
    setSortBtn('unitSortAlpha', ft('az'), unitSort.startsWith('alpha'), unitSort.endsWith('desc'));
    setSortBtn('skinSortId', 'ID', skinSort.startsWith('id'), skinSort.endsWith('desc'));
    setSortBtn('skinSortAlpha', ft('az'), skinSort.startsWith('alpha'), skinSort.endsWith('desc'));
}

function cycleUnitSort(kind) {
    if (kind === 'id') unitSort = unitSort === 'id-asc' ? 'id-desc' : 'id-asc';
    else unitSort = unitSort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc';
    sortUnitItems();
    updateSortButtons();
    applyUnitFilter(true);
}

function cycleSkinSort(kind) {
    if (kind === 'id') skinSort = skinSort === 'id-asc' ? 'id-desc' : 'id-asc';
    else skinSort = skinSort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc';
    sortSkinCards();
    updateSortButtons();
    applySkinFilter(true);
}

function refreshFilterRow(row, activeSet) {
    Array.from(row.querySelectorAll('.filter-btn')).forEach(btn => {
        if (btn.classList.contains('filter-all')) {
            btn.classList.toggle('active', activeSet.size === 0);
        } else {
            btn.classList.toggle('active', activeSet.has(btn.dataset.key));
        }
    });
}

function buildFilterRow(rowId, items, activeSet, onToggle) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn filter-all' + (activeSet.size === 0 ? ' active' : '');
    allBtn.textContent = ft('all');
    allBtn.onclick = () => {
        activeSet.clear();
        refreshFilterRow(row, activeSet);
        onToggle();
    };
    row.appendChild(allBtn);

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (activeSet.has(item.key) ? ' active' : '');
        btn.dataset.key = item.key;
        if (item.title) btn.title = item.title;
        if (item.icon) {
            const im = document.createElement('img');
            im.className = 'sq sq-img';
            im.src = item.icon;
            im.alt = '';
            im.loading = 'lazy';
            im.onerror = () => { im.style.display = 'none'; };
            btn.appendChild(im);
        } else if (item.square) {
            const sq = document.createElement('span');
            sq.className = 'sq';
            sq.textContent = item.square.text;
            sq.style.background = item.square.bg;
            if (item.square.fg) sq.style.color = item.square.fg;
            btn.appendChild(sq);
        }
        const labelNode = document.createTextNode(item.label);
        btn.appendChild(labelNode);
        if (!item.icon && !item.square) btn.classList.add('filter-btn-text-only');
        btn.onclick = () => {
            if (activeSet.has(item.key)) activeSet.delete(item.key);
            else activeSet.add(item.key);
            refreshFilterRow(row, activeSet);
            onToggle();
        };
        row.appendChild(btn);
    });
}

function buildFilterRows() {
    // Rebuilt on every language swap (labels localized); active sets are preserved.
    const stars = Array.from(new Set(
        Object.values(characterData.characters || {}).map(ch => getUnitTag(ch.internal_id).star)
    )).sort((a, b) => b - a).filter(s => s > 0);
    const rarityItems = stars.map(s => ({
        key: String(s),
        label: s + '★'
    }));

    const elementPrimaryItems = ELEMENT_ORDER.map(e => ({
        key: String(e),
        label: elemName(e),
        title: elemName(e),
        icon: ELEMENT_INFO[e].icon,
        square: { text: ELEMENT_INFO[e].code, bg: ELEMENT_INFO[e].color }
    }));

    const elementSecondaryItems = ELEMENT_ORDER.map(e => ({
        key: String(e),
        label: elemName(e),
        title: elemName(e),
        icon: ELEMENT_INFO[e].icon,
        square: { text: ELEMENT_INFO[e].code, bg: ELEMENT_INFO[e].color }
    }));

    const classItems = CLASS_ORDER.map(c => ({
        key: String(c),
        label: clsName(c),
        title: clsName(c),
        icon: CLASS_INFO[c].icon
    }));

    const factionItems = FACTION_ORDER.map(f => ({
        key: String(f),
        label: factionName(f),
        title: factionName(f),
        icon: FACTION_INFO[f].icon,
        square: { text: factionName(f).slice(0, 2).toUpperCase(), bg: FACTION_INFO[f].color }
    }));

    buildFilterRow('unitRarityFilters', rarityItems, unitFilter.rarity, () => applyUnitFilter(true));
    buildFilterRow('unitClassFilters', classItems, unitFilter.cls, () => applyUnitFilter(true));
    buildFilterRow('unitPrimaryFilters', elementPrimaryItems, unitFilter.pe, () => applyUnitFilter(true));
    buildFilterRow('unitSecondaryFilters', elementSecondaryItems, unitFilter.se, () => applyUnitFilter(true));
    buildFilterRow('unitFactionFilters', factionItems, unitFilter.faction, () => applyUnitFilter(true));
    buildFilterRow('skinRarityFilters', rarityItems, skinFilter.rarity, () => applySkinFilter(true));
    buildFilterRow('skinClassFilters', classItems, skinFilter.cls, () => applySkinFilter(true));
    buildFilterRow('skinPrimaryFilters', elementPrimaryItems, skinFilter.pe, () => applySkinFilter(true));
    buildFilterRow('skinSecondaryFilters', elementSecondaryItems, skinFilter.se, () => applySkinFilter(true));
    buildFilterRow('skinFactionFilters', factionItems, skinFilter.faction, () => applySkinFilter(true));
}

function wireFilterSearch() {
    const unitSearch = document.getElementById('unitSearch');
    if (unitSearch && !unitSearch.dataset.wired) {
        unitSearch.dataset.wired = '1';
        let t = null;
        unitSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                unitFilter.q = unitSearch.value.trim().toLowerCase();
                applyUnitFilter(true);
            }, 120);
        });
    }
    const skinSearch = document.getElementById('skinSearch');
    if (skinSearch && !skinSearch.dataset.wired) {
        skinSearch.dataset.wired = '1';
        let t = null;
        skinSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                skinFilter.q = skinSearch.value.trim().toLowerCase();
                applySkinFilter(true);
            }, 120);
        });
    }
}




function importQR() {
    const fileInput = document.getElementById('qrInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const imageData = e.target.result;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const image = new Image();
        image.onload = function () {
            canvas.width = image.width;
            canvas.height = image.height;
            context.drawImage(image, 0, 0);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                document.getElementById('output').value = code.data;
                updateUIFromQR(code.data);
            } else {
                alert('No QR code found.');
            }
        };
        image.src = imageData;
    };
    reader.readAsDataURL(file);
}

function downloadQR() {
    const inputText = document.getElementById('output').value;
    qrGenerated = true;

    const username = document.getElementById('usernameInput').value.trim() || 'user';
    const userId = document.getElementById('idInput').value.trim() || 'ID';
    
    let qrOptions = { errorCorrectionLevel: 'M', width: 400 };
    QRCode.toDataURL(inputText, qrOptions, async function (error, url) {
        if (error) {
            console.error('Error generating QR code:', error);
            showErrorModal();
            return;
        }
        
        const finalUrl = await assembleQRWithExtras(url, username, userId);
        const qrImage = document.getElementById('qrImage');
        qrImage.src = finalUrl;
        qrImage.style.display = 'block';

        const safeUsername = username
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();

        const safeUserId = userId
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();

        const downloadLink = document.createElement('a');
        downloadLink.href = finalUrl;
        downloadLink.download = `QRCode-${safeUsername}-${safeUserId}.png`;
        downloadLink.click();
    });
}

function copyToClipboard() {
    const textArea = document.getElementById('output');
    textArea.select();
    document.execCommand('copy');

    alert('Text copied to clipboard!');
}

function updateUIFromQR(data) {
    const parts = data.split('|');
    if (parts.length < 4) {
        alert('Invalid QR code data!');
        return;
    }

    // Check if the data is in the T/F format
    if (parts[0].match(/^[TF]+$/)) {
        updateCheckboxesFromTF(parts[0], 'checkboxesTab1');
        updateCheckboxesFromTF(parts[1], 'checkboxesTab2');
    } else {
        const units = parts[0].split(',');
        const skins = parts[1].split(',');
        updateCheckboxesFromArray(units, 'checkboxesTab1');
        updateCheckboxesFromArray(skins, 'checkboxesTab2');
    }

    const id = parts[2];
    const username = decodeURIComponent(JSON.parse('"' + parts[3] + '"'));
    document.getElementById('idInput').value = id;
    document.getElementById('usernameInput').value = username;
    updateText();
    alert('QR import successful!');
}

function updateCheckboxesFromArray(values, containerId) {
    const checkboxes = document.getElementById(containerId).querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
        checkbox.checked = values.includes(checkbox.value);
    });
}

function updateCheckboxesFromTF(values, containerId) {
    const checkboxes = document.getElementById(containerId).querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((checkbox) => {
        const id = parseInt(checkbox.value);
        if (!isNaN(id)) {
            const index = id - 1;
            if (index >= 0 && index < values.length) {
                checkbox.checked = values.charAt(index) === 'T';
            } else {
                checkbox.checked = false;
            }
        }
    });
}

function randomizeUnits() {
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    unitCheckboxes.forEach((checkbox) => {
        // Randomly check or uncheck the box
        checkbox.checked = Math.random() < 0.5;
    });
    updateText();
}

function selectAllUnits() {
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    unitCheckboxes.forEach((checkbox) => {
        checkbox.checked = true;
    });
    updateText();
}

function selectNoneUnits() {
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    unitCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
    updateText();
}

function selectAllSkins() {
    const skinCheckboxes = document.getElementById('checkboxesTab2').querySelectorAll("input[type='checkbox']");
    skinCheckboxes.forEach((checkbox) => {
        checkbox.checked = true;
    });
    updateText();
}

function selectNoneSkins() {
    const skinCheckboxes = document.getElementById('checkboxesTab2').querySelectorAll("input[type='checkbox']");
    skinCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
    updateText();
}

function showEditWarning() {
    const modal = document.getElementById('editWarningModal');
    modal.style.display = 'flex';
}

function hideEditWarning() {
    const modal = document.getElementById('editWarningModal');
    modal.style.display = 'none';
}

function enableTextEditing() {
    // Remove readonly from textarea
    const textarea = document.getElementById('output');
    textarea.removeAttribute('readonly');

    // Disable tabs other than QR and Debug
    const tablinks = document.getElementsByClassName('tablinks');
    for (let i = 0; i < tablinks.length; i++) {
        const tabButton = tablinks[i];
        const tabText = tabButton.textContent;

        // Only keep QR and Debug tabs enabled
        if (tabText !== 'QR' && tabText !== 'Debug') {
            tabButton.classList.add('disabled');
        }
    }

    // Hide the modal
    hideEditWarning();

    // Switch to the Debug tab
    const textTab = Array.from(tablinks).find(tab => tab.textContent === 'Debug');
    if (textTab && !textTab.classList.contains('active')) {
        textTab.click();
    }
}

function showErrorModal() {
    const modal = document.getElementById('errorModal');
    modal.style.display = 'flex';
}

function hideErrorModal() {
    const modal = document.getElementById('errorModal');
    modal.style.display = 'none';
}

// Function to update UI elements with translations
function updateUI() {
    // Update tab button text
    const qrTab = document.querySelector('button[onclick*="openTab(event, \'QR\')"]');
    if (qrTab) qrTab.textContent = t('qr_tab');

    const unitsTab = document.querySelector('button[onclick*="openTab(event, \'Units\')"]');
    if (unitsTab) unitsTab.textContent = t('units_tab');

    const skinsTab = document.querySelector('button[onclick*="openTab(event, \'Skins\')"]');
    if (skinsTab) skinsTab.textContent = t('skins_tab');

    const idTab = document.querySelector('button[onclick*="openTab(event, \'ID\')"]');
    if (idTab) idTab.textContent = t('id_tab');

    const nameTab = document.querySelector('button[onclick*="openTab(event, \'Username\')"]');
    if (nameTab) nameTab.textContent = t('name_tab');

    const debugTab = document.querySelector('button[onclick*="openTab(event, \'PlainText\')"]');
    if (debugTab) debugTab.textContent = t('debug_tab');

    // Update QR tab buttons
    const importButton = document.getElementById('importQRButton');
    if (importButton) importButton.textContent = t('import_qr');

    const downloadButton = document.getElementById('downloadQRButton');
    if (downloadButton) downloadButton.textContent = t('download_qr');

    // Update Units tab buttons
    const unitsAllButton = document.querySelector('button[onclick="selectAllUnits()"]');
    if (unitsAllButton) unitsAllButton.textContent = t('all');

    const unitsNoneButton = document.querySelector('button[onclick="selectNoneUnits()"]');
    if (unitsNoneButton) unitsNoneButton.textContent = t('none');

    const unitsRandomButton = document.querySelector('button[onclick="randomizeUnits()"]');
    if (unitsRandomButton) unitsRandomButton.textContent = t('randomize');

    // Update Skins tab buttons
    const skinsAllButton = document.querySelector('button[onclick="selectAllSkins()"]');
    if (skinsAllButton) skinsAllButton.textContent = t('all');

    const skinsNoneButton = document.querySelector('button[onclick="selectNoneSkins()"]');
    if (skinsNoneButton) skinsNoneButton.textContent = t('none');

    // Update PlainText tab buttons
    const copyButton = document.querySelector('.import-button[onclick*="copyToClipboard"]');
    if (copyButton) copyButton.textContent = t('copy_to_clipboard');

    const editButton = document.querySelector('button[onclick="showEditWarning()"]');
    if (editButton) editButton.textContent = t('enable_text_editing');

    const tfButton = document.querySelector('button[onclick="toggleQRStyle()"]');
    if (tfButton) {
        tfButton.textContent = t('toggle_qr_style');
    }

    const testZipButton = document.querySelector('button[onclick="generateTestZip()"]');
    if (testZipButton) {
        testZipButton.textContent = t('test_zip');
    }

    // Update modal content
    const warningModalP = document.querySelector('#editWarningModal .modal-content p');
    if (warningModalP) {
        warningModalP.innerHTML = `${t('warning')}<br>${t('warning_desc')}<br>${t('warning_effect')}`;
    }

    const errorModalP = document.querySelector('#errorModal .modal-content p');
    if (errorModalP) {
        errorModalP.innerHTML = `${t('error')}<br>${t('qr_failed')}<br>${t('qr_too_long')}`;
    }

    // Update modal buttons
    const confirmButton = document.querySelector('#editWarningModal .modal-button.confirm');
    if (confirmButton) confirmButton.textContent = t('confirm');

    const cancelButton = document.querySelector('#editWarningModal .modal-button.cancel');
    if (cancelButton) cancelButton.textContent = t('cancel');

    const okButton = document.querySelector('#errorModal .modal-button.cancel');
    if (okButton) okButton.textContent = t('ok');

    // Update title in the HTML document
    document.title = t('title');

    // Update the username input placeholder if it exists in translations
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.placeholder = t('username_placeholder') || '';
    }

    // Update the ID input placeholder if it exists in translations
    const idInput = document.getElementById('idInput');
    if (idInput) {
        idInput.placeholder = t('id_placeholder') || '';
    }

    // Update context menu
    const contextDownloadBtn = document.getElementById('contextDownloadBtn');
    if (contextDownloadBtn) contextDownloadBtn.textContent = t('download_qr');

    const toggleNameBtn = document.getElementById('toggleNameBtn');
    if (toggleNameBtn) {
        toggleNameBtn.textContent = isNameVisible ? t('hide_name') : t('show_name');
    }

    const toggleIDBtn = document.getElementById('toggleIDBtn');
    if (toggleIDBtn) {
        toggleIDBtn.textContent = isIDVisible ? t('hide_id') : t('show_id');
    }

    const rerollPicturesBtn = document.getElementById('rerollPicturesBtn');
    if (rerollPicturesBtn) {
        rerollPicturesBtn.textContent = t('randomize_pictures');
    }

    // Update the language selector to match current language
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.value = currentLanguage;
    }

    updateFilterChrome();
}

// Filter chrome (row labels, search placeholders) follows the current language
function updateFilterChrome() {
    const cats = ['rarity', 'class', 'primary', 'secondary', 'faction'];
    ['Units', 'Skins'].forEach(tab => {
        const labels = document.querySelectorAll('#' + tab + ' .filter-label');
        labels.forEach((span, i) => {
            if (cats[i]) span.textContent = ft(cats[i]);
        });
    });
    const unitSearch = document.getElementById('unitSearch');
    if (unitSearch) unitSearch.placeholder = ft('search');
    const skinSearch = document.getElementById('skinSearch');
    if (skinSearch) skinSearch.placeholder = ft('search');
    updateSortButtons();
}

// URL updating is disabled as per user request
function updateURL() {
    // No operation - URL changes are disabled
    return;
}

// Function to change language
async function changeLanguage(lang) {
    if (lang === currentLanguage) return;

    try {
        // Save the current state
        const unitState = getCheckboxStates('checkboxesTab1');
        const skinState = getCheckboxStates('checkboxesTab2');

        // Update the current language
        currentLanguage = lang;

        // Load translations for the new language
        await loadTranslations();

        // Update the UI with the new language
        updateUI();

        // Rebuild filter rows in the new language (active selections preserved)
        buildFilterRows();

        // Reload the checkboxes with the new language
        loadCheckboxes();

        // Restore the checkbox states after a small delay to ensure DOM is updated
        setTimeout(() => {
            setCheckboxStates('checkboxesTab1', unitState);
            setCheckboxStates('checkboxesTab2', skinState);
            updateText();
        }, 50);

        // Update the URL with the new language
        updateURL();
    } catch (error) {
        console.error('Error changing language:', error);
    }
}

function toggleQRStyle() {
    useFTStyle = !useFTStyle;

    // Update button text
    const tfButton = document.querySelector('button[onclick="toggleQRStyle()"]');
    if (tfButton) {
        tfButton.textContent = t('toggle_qr_style');
    }

    // Regenerate the text with the new style
    updateText();
}

async function generateTestZip() {
    const zip = new JSZip();
    const count = 40;
    
    // Save current state
    const originalUnits = getCheckboxStates('checkboxesTab1');
    const originalSkins = getCheckboxStates('checkboxesTab2');
    const originalId = document.getElementById('idInput').value;
    const originalUsername = document.getElementById('usernameInput').value;
    
    for (let i = 0; i < count; i++) {
        const paddedIndex = String(i + 1).padStart(2, '0');
        const currentTestName = `Test #${paddedIndex}`;
        
        // Update Name and ID fields for this test case
        document.getElementById('usernameInput').value = currentTestName;
        document.getElementById('idInput').value = originalId + paddedIndex;
        
        // Randomize units (this calls updateText internally)
        randomizeUnits();
        
        const inputText = document.getElementById('output').value;
        const qrOptions = { 
            errorCorrectionLevel: 'M',
            width: 400
        };
        
        const qrUrl = await new Promise((resolve) => {
            QRCode.toDataURL(inputText, qrOptions, (err, url) => resolve(url));
        });
        
        if (qrUrl) {
            // Generate the decorated version
            const currentTestId = document.getElementById('idInput').value;
            const finalUrl = await assembleQRWithExtras(qrUrl, currentTestName, currentTestId);
            const base64Data = finalUrl.split(',')[1];
            zip.file(`TestQR_${paddedIndex}.png`, base64Data, {base64: true});
        }
    }
    
    // Restore original state
    setCheckboxStates('checkboxesTab1', originalUnits);
    setCheckboxStates('checkboxesTab2', originalSkins);
    document.getElementById('idInput').value = originalId;
    document.getElementById('usernameInput').value = originalUsername;
    updateText();
    
    const content = await zip.generateAsync({type: "blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "Test_QRs.zip";
    link.click();
}

// Initialize the application
window.addEventListener('DOMContentLoaded', async function() {
    await loadImages();
    detectAndSetLanguage();
    await loadTranslations();
    updateUI();
    buildFilterRows();
    wireFilterSearch();
    loadCheckboxes();

    // Set up listeners
    const idInput = document.getElementById('idInput');
    if (idInput) {
        // Strip non-numbers immediately so they can't type letters
        idInput.addEventListener('input', function() {
            let val = this.value.replace(/[^0-9]/g, '');
            if (this.value !== val) {
                this.value = val;
            }
        });
        // Full validation (range, bounds) only on blur/change
        idInput.addEventListener('change', validateID);
    }

    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
            resizeLanguageSelector();
        });
    }
    
    // Set default tab
    const firstTab = document.querySelector('.tablinks');
    if (firstTab) firstTab.click();

    // Ensure the custom 'Cinzel' font is fully loaded before the first heavy QR render
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (document.getElementById('QR').style.display === 'block') {
                updateText();
            }
        });
    }

    // Custom context menu logic for the QR image
    const qrImage = document.getElementById('qrImage');
    const customMenu = document.getElementById('customContextMenu');

    if (qrImage && customMenu) {
        qrImage.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            customMenu.style.display = 'block';
            customMenu.style.left = e.pageX + 'px';
            customMenu.style.top = e.pageY + 'px';
        });

        document.addEventListener('click', function(e) {
            if (customMenu && !customMenu.contains(e.target)) {
                customMenu.style.display = 'none';
            }
        });
    }

    // Initial resize of language selector
    setTimeout(resizeLanguageSelector, 100);
});