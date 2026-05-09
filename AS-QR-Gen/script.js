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

    updateText();
}

function populateCharacterCheckboxes(container, unknownSet) {
    const characters = Object.values(characterData.characters);

    // Sort characters by QR ID
    characters.sort((a, b) => parseInt(a.qr_id) - parseInt(b.qr_id));

    characters.forEach(character => {
        const id = character.qr_id;
        const name = character.names ? (character.names[currentLanguage] || character.names['us'] || 'UNKNOWN') : 'UNKNOWN';

        if (name === 'UNKNOWN') {
            unknownSet.add(parseInt(id));
            return;
        }

        const checkbox = createCheckbox(id, name);
        container.appendChild(checkbox);
    });
}

function populateSkinCheckboxes(container, unknownSet) {
    skinData.skins.forEach(skin => {
        const id = skin.id;
        const name = skin.names ? (skin.names[currentLanguage] || skin.names['us'] || `UNKNOWN-${id}`) : `UNKNOWN-${id}`;

        if (name.startsWith('UNKNOWN')) {
            unknownSet.add(parseInt(id));
            return;
        }

        const checkbox = createCheckbox(id, name);
        container.appendChild(checkbox);
    });
}

function createCheckbox(value, label) {
    const container = document.createElement('label');
    container.style.display = 'block';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.onchange = updateText;
    checkbox.checked = true;
    container.appendChild(checkbox);
    container.appendChild(document.createTextNode(label));
    return container;
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