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
let useFTStyle = false;

// Track UNKNOWN positions for T/F format
let unitUnknownPositions = new Set();
let skinUnknownPositions = new Set();

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
            const response = await fetch(`./lang/${currentLanguage}.json`);
            if (response.ok) {
                translations[currentLanguage] = await response.json();
            } else if (currentLanguage !== 'us') {
                // Fallback to English if the requested language doesn't exist
                currentLanguage = 'us';
                const enResponse = await fetch('./lang/us.json');
                if (enResponse.ok) {
                    translations['us'] = await enResponse.json();
                }
            }
        } catch (e) {
            console.error('Error loading UI translations:', e);
            if (currentLanguage !== 'us' && !translations['us']) {
                try {
                    const enResponse = await fetch('./lang/us.json');
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

// Set the current language based on the browser's language
function detectAndSetLanguage() {
    if (!isInitialized) {
        const browserLang = navigator.language.slice(0, 2); // Get the first two characters of the browser language
        let matchedLang = Object.keys(languageMapping).find(key => languageMapping[key].code.startsWith(browserLang));
        currentLanguage = matchedLang || 'us';
        isInitialized = true; // Mark the application as initialized
    }
}

function updateText() {
    let unitOutput = [];
    let skinOutput = [];
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    const skinCheckboxes = document.getElementById('checkboxesTab2').querySelectorAll("input[type='checkbox']");
    const idValue = document.getElementById('idInput').value;
    const username = document.getElementById('usernameInput').value;

    if (useFTStyle) {
        // FT Style: Build full sequence including UNKNOWN positions as F
        unitOutput = buildTFSequence(unitCheckboxes, unitUnknownPositions);
        skinOutput = buildTFSequence(skinCheckboxes, skinUnknownPositions);
        document.getElementById("output").value = unitOutput + '|' + skinOutput + '|' + idValue + '|' + username;
    } else {
        // Default Style: Only include checked checkbox values
        unitCheckboxes.forEach((checkbox) => {
            if (checkbox.checked) {
                unitOutput.push(checkbox.value);
            }
        });
        skinCheckboxes.forEach((checkbox) => {
            if (checkbox.checked) {
                skinOutput.push(checkbox.value);
            }
        });
        document.getElementById("output").value = unitOutput.join(',') + '|' + skinOutput.join(',') + '|' + idValue + '|' + username;
    }
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

document.addEventListener("DOMContentLoaded", async function() {
    // First detect the language
    detectAndSetLanguage();
    
    // Then load translations for the detected language
    await loadTranslations();
    
    // Update the UI with the loaded translations
    updateUI();
    
    // Set up the language selector change event
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.value = currentLanguage;
        languageSelector.addEventListener('change', (e) => changeLanguage(e.target.value));
    }
    await loadTranslations();
    updateUI(); // Update UI with translations
    document.getElementsByClassName("tablinks")[0].click();
    loadCheckboxes();
    
    // Force update UI again after a short delay to ensure all elements are loaded
    setTimeout(updateUI, 100);
});

function importQR() {
    const fileInput = document.getElementById('qrInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const image = new Image();
        image.onload = function() {
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
    
    // Check if text is too long for QR code
    // QR Version 40 with error correction L can handle approximately 2953 bytes
    const maxBytes = 2953;
    const textBytes = new Blob([inputText]).size;
    
    if (textBytes > maxBytes) {
        showErrorModal();
        return;
    }
    
    const qrOptions = {
        scale: 1, // Set scale to 1 to make each dot 1 pixel in size
        version: 40, // Use the highest version for maximum data capacity
        errorCorrectionLevel: 'L' // Use low error correction for more data capacity
    };
    QRCode.toDataURL(inputText, qrOptions, function (error, url) {
        if (error) {
            console.error('Error generating QR code:', error);
            showErrorModal();
            return;
        }
        const qrImage = document.getElementById('qrImage');
        qrImage.src = url;
        qrImage.style.display = 'block'; 

        // Get username and ID from input fields
        const username = document.getElementById('usernameInput').value.trim() || 'user';
        const userId = document.getElementById('idInput').value.trim() || 'ID';
        
        // Create a safe filename by removing invalid characters while preserving CJK and other Unicode letters
        const safeUsername = username
            .replace(/[\\/:*?"<>|]/g, '_')  // Only remove truly problematic filename characters
            .replace(/\s+/g, ' ')            // Replace multiple spaces with single space
            .trim()
            .substring(0, 30);
            
        const safeUserId = userId
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 15);
        
        // Create download link with formatted filename
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
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
    checkboxes.forEach((checkbox, index) => {
        if (index < values.length) {
            checkbox.checked = values.charAt(index) === 'T';
        } else {
            checkbox.checked = false;
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
    if (tfButton) tfButton.textContent = t('use_tf_qr');
    
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
    
    // Update button appearance
    const buttons = document.querySelectorAll('.edit-toggle-button');
    const ftButton = Array.from(buttons).find(btn => btn.textContent.includes(t('use_tf_qr')) || btn.textContent.includes('T/F'));
    
    if (ftButton) {
        if (useFTStyle) {
            ftButton.classList.add('active-style');
        } else {
            ftButton.classList.remove('active-style');
        }
    }
    
    // Regenerate the text with the new style
    updateText();
}