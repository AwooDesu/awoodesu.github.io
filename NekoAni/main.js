let currentData = [];
let currentFolder = 'card';
let player = null;
let live2dApp = null;
let live2dModel = null;
let activeItem = null;
let activeElement = null;
let allManifestData = null;

// Object to store the unique settings per folder
let camSettings = {};

// ============================================================================
// Live2D Cleanup (defined early so it can be called anywhere)
// ============================================================================
function cleanupLive2D() {
    if (live2dModel) {
        try {
            if (live2dApp && live2dApp.stage) {
                live2dApp.stage.removeChild(live2dModel);
            }
            live2dModel.destroy();
        } catch (e) {
            console.warn("Live2D model cleanup error:", e);
        }
        live2dModel = null;
    }
    if (live2dApp) {
        try {
            live2dApp.destroy(true);
        } catch (e) {
            console.warn("PIXI app cleanup error:", e);
        }
        live2dApp = null;
    }

    // Hide canvas
    const canvas = document.getElementById('live2d-canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }
}

function calculateBestFit(folder) {
    if (folder === 'sd') {
        // SD characters: zoom 2700, x 0, y 500
        return { zoom: 2700, x: 0, y: 500 };
    }
    if (folder === 'live2d') {
        // Live2D: centered with appropriate zoom
        return { zoom: 2700, x: 0, y: 0 };
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

            // Clean Spine player
            if (player) {
                try { player.dispose(); } catch(err){ console.warn("Spine dispose:", err); }
                player = null;
            }

            // Clean Live2D
            cleanupLive2D();

            // Reset containers
            document.getElementById('player-container').innerHTML = '<div class="no-selection"><div class="icon">?</div></div>';

            // Hide all special controls
            document.getElementById('anim-control').style.display = 'none';
            document.getElementById('expression-control').style.display = 'none';
            document.getElementById('motion-control').style.display = 'none';

            // Reset active item
            activeItem = null;
            activeElement = null;

            loadSettingsForFolder(currentFolder);
            await fetchFolderData(currentFolder);
        });
    });
}

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
        li.onclick = () => {
            if (item.type === 'live2d') {
                loadLive2D(item, li);
            } else {
                loadSpine(item, li);
            }
        };
        list.appendChild(li);
    });
}

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
            if (activeItem && activeItem.type === 'live2d' && live2dModel) {
                applyLive2DSettings();
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

    // Handle Live2D expression selection
    const expressionSelector = document.getElementById('expressionSelector');
    expressionSelector.addEventListener('change', (e) => {
        if (live2dModel && e.target.value) {
            try {
                live2dModel.expression(e.target.value);
            } catch (err) {
                console.warn("Expression error:", err);
            }
        }
    });

    // Handle Live2D motion selection
    const motionSelector = document.getElementById('motionSelector');
    motionSelector.addEventListener('change', (e) => {
        if (live2dModel && e.target.value) {
            try {
                const [group, index] = e.target.value.split(':');
                live2dModel.motion(group, parseInt(index));
            } catch (err) {
                console.warn("Motion error:", err);
            }
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

    // Cleanup Live2D if active
    cleanupLive2D();

    // Hide Live2D controls
    document.getElementById('expression-control').style.display = 'none';
    document.getElementById('motion-control').style.display = 'none';

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


// ============================================================================
// Live2D Support
// ============================================================================

function applyLive2DSettings() {
    if (!live2dModel) return;

    // Scale based on zoom (2700 = 1x)
    const scale = camSettings.zoom / 2700;
    live2dModel.scale.set(scale);

    // Position adjustments
    const canvas = document.getElementById('live2d-canvas');
    if (!canvas) return;

    const centerX = canvas.width / 2 + camSettings.x * 0.5;
    const centerY = canvas.height / 2 - camSettings.y * 0.5;
    live2dModel.x = centerX;
    live2dModel.y = centerY;
}

async function loadLive2D(item, element) {
    activeItem = item;
    activeElement = element;

    document.querySelectorAll('.spine-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    const container = document.getElementById('player-container');

    // Hide Spine player first
    if (player) {
        try { player.dispose(); } catch (e) { console.warn("Spine dispose error:", e); }
        player = null;
    }
    container.innerHTML = '<div class="loading">Loading Live2D model...</div>';

    // Hide Spine animation control
    document.getElementById('anim-control').style.display = 'none';

    // Cleanup previous Live2D
    cleanupLive2D();

    try {
        // Get or create canvas
        let canvas = document.getElementById('live2d-canvas');
        if (!canvas) {
            // Recreate canvas if it was removed
            canvas = document.createElement('canvas');
            canvas.id = 'live2d-canvas';
            document.querySelector('.viewer-container').appendChild(canvas);
        }

        // Setup canvas
        const viewerContainer = document.querySelector('.viewer-container');
        canvas.width = viewerContainer.clientWidth;
        canvas.height = viewerContainer.clientHeight;
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        // Create PIXI app
        live2dApp = new PIXI.Application({
            view: canvas,
            width: canvas.width,
            height: canvas.height,
            backgroundAlpha: 0,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Load model
        const modelUrl = item.model;
        live2dModel = await PIXI.live2d.Live2DModel.from(modelUrl);

        // Initial positioning
        live2dModel.anchor.set(0.5, 0.5);
        applyLive2DSettings();

        // Add to stage
        live2dApp.stage.addChild(live2dModel);

        // Enable interaction (eyes follow mouse)
        live2dModel.interactive = true;

        // Drag state
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let modelStartX = 0;
        let modelStartY = 0;

        // Mouse down - start drag
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                modelStartX = live2dModel.x;
                modelStartY = live2dModel.y;
                canvas.style.cursor = 'grabbing';
            }
        });

        // Mouse move - drag or eye tracking
        canvas.addEventListener('mousemove', (e) => {
            if (live2dModel) {
                if (isDragging) {
                    const dx = e.clientX - dragStartX;
                    const dy = e.clientY - dragStartY;
                    live2dModel.x = modelStartX + dx;
                    live2dModel.y = modelStartY + dy;
                } else {
                    // Eyes follow mouse when not dragging
                    live2dModel.focus(e.offsetX, e.offsetY);
                }
            }
        });

        // Mouse up - end drag
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                isDragging = false;
                canvas.style.cursor = 'grab';
            }
        });

        // Mouse leave - end drag
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });

        // Mouse wheel - zoom in/out
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (live2dModel) {
                const zoomFactor = 0.1;
                const currentScale = live2dModel.scale.x;

                // Zoom in or out based on wheel direction
                let newScale;
                if (e.deltaY < 0) {
                    // Scroll up - zoom in
                    newScale = currentScale * (1 + zoomFactor);
                } else {
                    // Scroll down - zoom out
                    newScale = currentScale * (1 - zoomFactor);
                }

                // Clamp scale to reasonable limits
                newScale = Math.max(0.1, Math.min(5, newScale));
                live2dModel.scale.set(newScale);
            }
        }, { passive: false });

        // Set initial cursor
        canvas.style.cursor = 'grab';

        // Populate expression dropdown
        const expressionControl = document.getElementById('expression-control');
        const expressionSelector = document.getElementById('expressionSelector');
        expressionSelector.innerHTML = '<option value="">-- None --</option>';

        if (live2dModel.internalModel && live2dModel.internalModel.motionManager) {
            const expressions = live2dModel.internalModel.motionManager.expressionManager;
            if (expressions && expressions.definitions) {
                expressions.definitions.forEach((exp, i) => {
                    const opt = document.createElement('option');
                    opt.value = exp.Name || exp.name || i;
                    opt.textContent = exp.Name || exp.name || `Expression ${i}`;
                    expressionSelector.appendChild(opt);
                });
                if (expressions.definitions.length > 0) {
                    expressionControl.style.display = 'block';
                }
            }
        }

        // Populate motion dropdown
        const motionControl = document.getElementById('motion-control');
        const motionSelector = document.getElementById('motionSelector');
        motionSelector.innerHTML = '<option value="">-- None --</option>';

        if (live2dModel.internalModel && live2dModel.internalModel.motionManager) {
            const motionManager = live2dModel.internalModel.motionManager;
            const motionGroups = motionManager.definitions;

            if (motionGroups) {
                Object.keys(motionGroups).forEach(group => {
                    const motions = motionGroups[group];
                    if (Array.isArray(motions)) {
                        motions.forEach((motion, index) => {
                            const opt = document.createElement('option');
                            opt.value = `${group}:${index}`;
                            opt.textContent = `${group} - ${index}`;
                            motionSelector.appendChild(opt);
                        });
                    }
                });
                if (Object.keys(motionGroups).length > 0) {
                    motionControl.style.display = 'block';
                }
            }
        }

        // Clear loading message
        container.innerHTML = '';

        console.log("Live2D model loaded:", item.id);

    } catch (error) {
        console.error("Live2D load error:", error);
        container.innerHTML = `<div class="loading" style="color:#ff6b6b;">Error loading Live2D model:<br>${error.message}</div>`;
        const canvasEl = document.getElementById('live2d-canvas');
        if (canvasEl) canvasEl.style.display = 'none';
        document.getElementById('expression-control').style.display = 'none';
        document.getElementById('motion-control').style.display = 'none';
        // Clean up any partial state
        cleanupLive2D();
    }
}

// Handle window resize for Live2D
window.addEventListener('resize', () => {
    if (live2dApp && live2dModel) {
        const canvas = document.getElementById('live2d-canvas');
        if (!canvas) return;

        const viewerContainer = document.querySelector('.viewer-container');
        canvas.width = viewerContainer.clientWidth;
        canvas.height = viewerContainer.clientHeight;
        live2dApp.renderer.resize(canvas.width, canvas.height);
        applyLive2DSettings();
    }
});
