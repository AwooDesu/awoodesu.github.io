function openTab(evt, tabName) {
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

function updateText() {
    let unitOutput = [];
    let skinOutput = [];
    const unitCheckboxes = document.getElementById('checkboxesTab1').querySelectorAll("input[type='checkbox']");
    const skinCheckboxes = document.getElementById('checkboxesTab2').querySelectorAll("input[type='checkbox']");
    const idValue = document.getElementById('idInput').value;
    const username = document.getElementById('usernameInput').value;

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

function loadCheckboxes() {
    fetch('ID.txt')
        .then(response => response.text())
        .then(data => {
            const tab1 = document.getElementById('checkboxesTab1');
            populateCheckboxes(data, tab1);
        });

    fetch('skin.txt')
        .then(response => response.text())
        .then(data => {
        const tab2 = document.getElementById('checkboxesTab2');
        populateCheckboxes(data, tab2);
    });
}

function populateCheckboxes(data, container) {
    const lines = data.split('\n');
    lines.forEach(line => {
        const [id, name] = line.split(',');
        const checkbox = createCheckbox(id, name);
        container.appendChild(checkbox);
    });
    updateText();
}

function createCheckbox(value, label) {
    const container = document.createElement('label');
    container.style.display = 'block'; 
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.onchange = updateText;
    checkbox.checked = !label.includes("UNKNOWN");
    container.appendChild(checkbox);
    container.appendChild(document.createTextNode(label));
    return container;
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementsByClassName("tablinks")[0].click();
    loadCheckboxes();
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
    const qrOptions = {
        scale: 1, // Set scale to 1 to make each dot 1 pixel in size
        version: 40, // Use the highest version for maximum data capacity
        errorCorrectionLevel: 'L' // Use low error correction for more data capacity
    };
    QRCode.toDataURL(inputText, qrOptions, function (error, url) {
        if (error) {
            console.error('Error generating QR code:', error);
            return;
        }
        const qrImage = document.getElementById('qrImage');
        qrImage.src = url;
        qrImage.style.display = 'block'; 

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'QRCode.png';
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
        const label = checkbox.parentElement.textContent;
        // Always leave UNKNOWN units unchecked
        if (label.includes("UNKNOWN")) {
            checkbox.checked = false;
        } else {
            // Randomly check or uncheck the box
            checkbox.checked = Math.random() < 0.5;
        }
    });
    updateText();
}