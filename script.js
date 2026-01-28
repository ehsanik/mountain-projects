function toggleSwitch(el) {
    const selectId = el.getAttribute('data-select');
    const select = document.getElementById(selectId);
    const isActive = el.classList.toggle('active');
    select.value = isActive ? 'yes' : 'no';
}

function makeCategoryHTML(title, items) {
    let html = '<div class="category-section">';
    html += '<h3 class="category-title">' + title + '</h3>';
    html += '<ul class="checklist">';
    for (const item of items) {
        html += '<li><label><input type="checkbox" onchange="updateProgress()"> <span class="item-text">' + item + '</span></label></li>';
    }
    html += '</ul></div>';
    return html;
}

function updateProgress() {
    const checkboxes = document.querySelectorAll('#result .checklist input[type="checkbox"]');
    const total = checkboxes.length;
    const checked = document.querySelectorAll('#result .checklist input[type="checkbox"]:checked').length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    const bar = document.querySelector('.progress-bar');
    const text = document.querySelector('.progress-text');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = checked + ' of ' + total + ' items packed (' + pct + '%)';
}

function removeForm() {
    const element = document.getElementById("questions");
    element.remove();
}

function checkAnswer(event) {
    event.preventDefault();
    const overnight = document.getElementById('overnight').value;
    const rock = document.getElementById('rock').value;
    const ice = document.getElementById('ice').value;
    const glacier = document.getElementById('glacier').value;
    const gender = document.getElementById('gender').value;
    const ski = document.getElementById('ski').value;
    const bear = document.getElementById('bear').value;
    const deep_snow = document.getElementById('deep_snow').value;
    const snow = document.getElementById('snow').value;
    const result = document.getElementById('result');

    let avy_gear = ["Beacon", "Shovel", "Probe"];
    let rescue_gear = ["Webbing and Cord", "Non Locking Carabineers", "Locking Carabineers", "Belay Device", "Chest Prusik", "Cordelette"];
    let glacier_gear = rescue_gear.concat(["Gaiters", "Blue Bag", "Crampons", "Ice Ax", "Helmet", "Rope", "Harness", "Pickets", "Foot Prusik"]);

    const packing_list_dict = {
        clothes: ["Liner Gloves", "Underwear", "Sun-blocking Shirt", "Clean Clothes for the ride", "Quick Dry Pants", "Fleece", "Socks (and extra)", "Rain Pants", "Rain Jacket", "Puffy", "Gloves", "Hat and/or Buff"],
        essentials: ["Backpack", "Map (Phone or Physical)", "Headlamp", "Compass/GPS/Phone", "inReach", "Proper Shoes or Boots", "Water Containers", "Water Filter", "Meals", "Energy bars / Gels / Snacks", "Toilet Paper", "Medication", "Sunglasses", "Sunscreen / Lip Balm", "Sun Hat", "Knife", "First Aid Kit", "Duct Tape", "Lighter", "Emergency Bivy", "Extra Batteries"],
        optionals: ["Poles", "Bug Spray", "Watch", "Sandals", "Permits", "Power Bank and Phone Chargers", "Phone Leash"],
        overnight: ["Tent", "Tent Footprint", "Sleeping Bag", "Sleeping Pad", "Pillow", "Stove", "Fuel", "Cookset", "Bowl/Utensil/Mug", "Tooth Brush", "Lighter", "Camp Chair"],
        rock: rescue_gear.concat(["Harness", "Helmet", "Radios", "Rope", "Nuts", "Cams", "Alpine Draws", "Nut Tool", "Gear Sling", "Runners", "Quick Draws", "Chalk and Chalk Bag", "Rock Shoes", "Belay and Crack Gloves"]),
        glacier: glacier_gear,
        snow: ["Gaiters", "Blue Bag", "Crampons", "Ice Ax", "Helmet"],
        ice: glacier_gear.concat(["Harness", "Helmet", "Ice Screws", "Radios", "Crampons", "Ice Tools"]),
        girl: ["Sport Bra", "Pad / Tampon / Menstural Cup", "Pee Funnel"],
        bear: ["Bear Canister / Ursack", "Bear Spray"],
        ski: avy_gear.concat(["Crampons", "Helmet", "Ski Pack", "Ski Crampons", "Ski Boots", "Skis", "Poles", "Skins", "Skin Wax", "Snow Pants", "Gloves", "Goggles", "Tarp", "Ski Cords", "Ski Leash", "Radios"]),
        deep_snow: avy_gear.concat(["Gaiters", "Snowshoes", "Crampons"]),
    };

    // Build categorized lists
    let categories = {};

    // Always include essentials and clothes
    categories["Essentials"] = [...packing_list_dict.essentials];
    categories["Clothing"] = [...packing_list_dict.clothes];

    if (overnight === "yes") {
        categories["Overnight Gear"] = [...packing_list_dict.overnight];
    }
    if (rock === "yes") {
        categories["Rock Climbing"] = [...packing_list_dict.rock];
    }
    if (ice === "yes") {
        categories["Ice Climbing"] = [...packing_list_dict.ice];
    }
    if (glacier === "yes") {
        categories["Glacier Travel"] = [...packing_list_dict.glacier];
    }
    if (snow === "yes") {
        categories["Snow Travel"] = [...packing_list_dict.snow];
    }
    if (ski === "yes") {
        categories["Skiing"] = [...packing_list_dict.ski];
    }
    if (deep_snow === "yes") {
        categories["Deep Snow"] = [...packing_list_dict.deep_snow];
    }
    if (bear === "yes") {
        categories["Wildlife Safety"] = [...packing_list_dict.bear];
    }
    if (gender === "female") {
        categories["Additional Items"] = [...packing_list_dict.girl];
    }

    // Deduplicate across all categories
    let seen = new Set();
    for (const cat in categories) {
        categories[cat] = categories[cat].filter(item => {
            if (seen.has(item)) return false;
            seen.add(item);
            return true;
        });
    }

    let totalItems = 0;
    for (const cat in categories) {
        totalItems += categories[cat].length;
    }
    totalItems += packing_list_dict.optionals.length;

    removeForm();

    // Build result HTML
    let html = '';
    html += '<div class="result-header">';
    html += '<h2>Your Pack List</h2>';
    html += '<p>' + totalItems + ' items for your adventure</p>';
    html += '</div>';

    html += '<div class="progress-bar-container"><div class="progress-bar"></div></div>';
    html += '<div class="progress-text">0 of ' + totalItems + ' items packed (0%)</div>';

    for (const cat in categories) {
        if (categories[cat].length > 0) {
            html += makeCategoryHTML(cat, categories[cat]);
        }
    }

    // Optionals as collapsible
    html += '<div class="optionals-toggle" onclick="toggleOptionals(this)">';
    html += '<span>Optional Items</span>';
    html += '<span class="arrow">&#9660;</span>';
    html += '</div>';
    html += '<div class="optionals-content">';
    html += makeCategoryHTML('Nice to Have', packing_list_dict.optionals);
    html += '</div>';

    // Reset button
    html += '<button class="btn-reset" onclick="location.reload()">Start Over</button>';

    result.innerHTML = html;

    return html;
}

function toggleOptionals(el) {
    el.classList.toggle('open');
    const content = el.nextElementSibling;
    content.classList.toggle('open');
}
