let player = null;
let currentData = [];
let currentFolder = 'card';


// Object to store the unique settings per folder
let camSettings = {};

function calculateBestFit(folder) {
    if (folder === 'sd') {
        // SD characters: zoom 2700, x 0, y 500
        return { zoom: 2700, x: 0, y: 500 };
    }
    return { zoom: 2700, x: 0, y: 0 };
}

function loadSettingsForFolder(folder) {
    camSettings = {
        zoom: parseInt(localStorage.getItem(`spineCamZoom_${folder}`)),
        x: parseInt(localStorage.getItem(`spineCamX_${folder}`)),
        y: parseInt(localStorage.getItem(`spineCamY_${folder}`))
    };
    
    const defaults = calculateBestFit(folder);
    if (isNaN(camSettings.zoom)) camSettings.zoom = defaults.zoom;
    if (isNaN(camSettings.x)) camSettings.x = defaults.x;
    if (isNaN(camSettings.y)) camSettings.y = defaults.y;

    // Refresh UI
    ['Zoom', 'X', 'Y'].forEach(param => {
        const input = document.getElementById(`cam${param}`);
        const span = document.getElementById(`val${param}`);
        if(input && span) {
            input.value = camSettings[param.toLowerCase()];
            span.textContent = input.value;
        }
    });
}

function saveSetting(folder, param, val) {
    camSettings[param.toLowerCase()] = parseInt(val);
    localStorage.setItem(`spineCam${param}_${folder}`, val);
}

async function init() {
    setupCameraControls();
    setupFolderTabs();
    await fetchFolderData(currentFolder);
}

function setupFolderTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        // Activate correct starting tab
        if(tab.dataset.folder === currentFolder) {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadSettingsForFolder(currentFolder);
        }

        tab.addEventListener('click', async (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFolder = e.target.dataset.folder;
            localStorage.setItem('activeFolder', currentFolder);
            
            // Clean player to prevent lag
            if (player) {
                try { player.dispose(); } catch(e){}
                player = null;
            }
            document.getElementById('player-container').innerHTML = '';
            
            loadSettingsForFolder(currentFolder);
            await fetchFolderData(currentFolder);
        });
    });
}

let allManifestData = null;

async function fetchFolderData(folder) {
    try {
        const list = document.getElementById('spineList');
        list.innerHTML = '<div class="loading">Loading...</div>';
        
        // Load the static manifest only once
        if (!allManifestData) {
            const res = await fetch('assets/data.json');
            allManifestData = await res.json();
        }
        
        currentData = allManifestData[folder] || [];
        
        document.getElementById('spineSearch').value = '';
        renderList(currentData);
    } catch (error) {
        console.error("List failed:", error);
        document.getElementById('spineList').innerHTML = '<div class="loading">Error loading manifest.json</div>';
    }
}


document.getElementById('spineSearch').addEventListener('input', (e) => {
    renderList(currentData.filter(s => s.id.toLowerCase().includes(e.target.value.toLowerCase())));
});

function renderList(items) {
    const list = document.getElementById('spineList');
    list.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'spine-item';
        li.innerHTML = `<div class="name">${item.id}</div>`;
        li.onclick = () => loadSpine(item, li);
        list.appendChild(li);
    });
}

let activeItem = null;
let activeElement = null;

// Camera controls initialization logic remains but removes the reset button
function setupCameraControls() {
    ['Zoom', 'X', 'Y'].forEach(param => {
        const input = document.getElementById(`cam${param}`);
        const span = document.getElementById(`val${param}`);
        
        input.addEventListener('input', (e) => {
            span.textContent = e.target.value;
            camSettings[param.toLowerCase()] = parseInt(e.target.value);
            if (activeItem && activeItem.type === 'image') {
                applyImageSettings();
            }
        });

        input.addEventListener('change', (e) => {
            saveSetting(currentFolder, param, e.target.value);
            if (activeItem && activeItem.type === 'spine') {
                loadSpine(activeItem, activeElement);
            }
        });
    });

    // Handle manual animation selection
    const selector = document.getElementById('animSelector');
    selector.addEventListener('change', (e) => {
        if (player) {
            player.setAnimation(e.target.value, true);
        }
    });
}

function applyImageSettings() {
    const img = document.getElementById('comic-image');
    if (!img) return;
    
    // Zoom range is ~500 to 8000. 2700 is our "1x" baseline.
    const scale = camSettings.zoom / 2700; 
    
    // Convert offsets into pixel adjustments. 
    // spineCamX=0 is center. Y positive is up.
    // CSS translate mapping: 
    const pxX = -camSettings.x; // Invert to match Spine panning
    const pxY = camSettings.y; 

    img.style.transform = `translate(-50%, -50%) translate(${pxX}px, ${pxY}px) scale(${scale})`;
}

function loadSpine(item, element) {
    activeItem = item;
    activeElement = element;

    document.querySelectorAll('.spine-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    const container = document.getElementById('player-container');
    
    if (player) {
        try { player.dispose(); } catch (e) { console.warn("Dispose error:", e); }
        player = null;
    }
    
    container.innerHTML = ''; 

    // Handle RAW PNG Comics
    if (item.type === 'image') {
        document.getElementById('anim-control').style.display = 'none';
        const img = document.createElement('img');
        img.id = 'comic-image';
        img.src = item.url;
        // Styling image to allow transforms
        img.style.position = 'absolute';
        img.style.left = '50%';
        img.style.top = '50%';
        img.style.transformOrigin = 'center center';
        img.style.transition = 'transform 0.1s ease-out';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        
        container.appendChild(img);
        applyImageSettings();
        return;
    }

    // Handle SPINES
    const animControl = document.getElementById('anim-control');
    const animSelector = document.getElementById('animSelector');

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const aspectRatio = cw / ch;

    let baseFit = calculateBestFit(currentFolder);
    let vHeight = baseFit.zoom * (baseFit.zoom / camSettings.zoom);
    let vWidth = vHeight * aspectRatio;
    const vX = camSettings.x - (vWidth / 2);
    const vY = camSettings.y - (vHeight / 2);

    const config = {
        skelUrl: item.skel,
        atlasUrl: item.atlas,
        scale: 0.5, 
        premultipliedAlpha: true,
        backgroundColor: "#00000000",
        alpha: true,
        showControls: false,
        viewport: {
            transitionTime: 0,
            x: vX, y: vY, width: vWidth, height: vHeight,
            padTop: 0, padBottom: 0, padLeft: 0, padRight: 0
        },
        success: (playerInstance) => {
            // Populate animation dropdown
            animControl.style.display = 'block';
            animSelector.innerHTML = '';
            const animations = playerInstance.skeleton.data.animations;
            
            animations.forEach(anim => {
                const opt = document.createElement('option');
                opt.value = anim.name;
                opt.textContent = anim.name;
                animSelector.appendChild(opt);
            });

            // Auto-select a valid skin - prioritizing Front/A views over Back views
            const skins = playerInstance.skeleton.data.skins;
            if (skins && skins.length > 0) {
                let targetSkin = skins.find(s => {
                    const n = s.name.toLowerCase();
                    return (n.includes('front') || n === 'a' || n.includes('_a')) && n !== 'default';
                });
                
                // Fallback to any non-default if no explicit front skin found
                if (!targetSkin) {
                    targetSkin = skins.find(s => s.name.toLowerCase() !== 'default') || skins[0];
                }
                
                playerInstance.skeleton.setSkinByName(targetSkin.name);
                playerInstance.skeleton.setSlotsToSetupPose();
            }

            if (animations.length > 0) {
                const idle = animations.find(a => {
                    const n = a.name.toLowerCase();
                    return n.includes('idle') || n.includes('standing') || n.includes('loop');
                }) || animations[0];
                
                animSelector.value = idle.name;
                playerInstance.setAnimation(idle.name, true);
                playerInstance.play();
            }
        },
        error: (playerInstance, msg) => {
            console.error("Spine Engine Error:", msg);
            container.innerHTML = `<div class="loading" style="color:#ff6b6b; padding: 2rem; max-width: 80%; text-align: center; font-size: 0.9rem;">Spine Engine Error:<br>${msg}</div>`;
        }
    };


    try {
        player = new spine.SpinePlayer("player-container", config);
    } catch (e) {
        container.innerHTML = `<div class="loading">Error: ${e.message}</div>`;
    }
}

window.onload = init;
