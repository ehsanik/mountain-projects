function make_str(unique_pack_list){

    final_html = "<ul>";

    for (const currentItem of unique_pack_list) {
        final_html = final_html + "<li><label>  <input type=\"checkbox\"> " +
        currentItem + "</label></li>";
    }
    return final_html + "</ul>"
}

function removeForm() {
    const formContainer = document.body;
    const element = document.getElementById("questions");
    element.remove();
}

function checkAnswer(event) {
    event.preventDefault()
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

    let rescue_gear = ["Webbing and Cord", "Non Locking Carabineers", "Locking Carabineers", "Belay Device", "Chest Prusik", "Cordelette"]
    let glacier_gear = rescue_gear.concat(["Gaiters", "Blue Bag", "Crampons", "Ice Ax", "Helmet", "Rope", "Harness", "Pickets", "Foot Prusik"]);

    const packing_list_dict = {
        clothes:["Underwear", "Sun-blocking Shirt", "Clean Clothes for the ride", "Quick Dry Pants", "Fleece", "Socks (and extra)", "Rain Pants", "Rain Jacket", "Puffy", "Gloves", "Hat and/or Buff"],
      essentials: ["Backpack", "Map (Phone or Physical)", "Headlamp", "Compass/GPS/Phone", "inReach", "Proper Shoes or Boots", "Water Containers", "Water Filter", "Meals", "Energy bars / Gels / Snacks", "Toilet Paper", "Medication", "Sunglasses", "Sunscreen / Lip Balm", "Sun Hat", "Knife", "First Aid Kit", "Duct Tape", "Lighter", "Emergency Bivy", "Extra Batteries"],
      optionals: ["Poles", "Bug Spray", "Watch", "Sandals", "Permits"],
      overnight: ["Tent", "Tent Footprint", "Sleeping Bag", "Sleeping Pad", "Pillow", "Stove", "Fuel", "Cookset", "Bowl/Utensil/Mug", "Tooth Brush", "Lighter"],
      rock: rescue_gear.concat(["Harness", "Helmet", "Radios", "Rope", "Nuts", "Cams", "Alpine Draws", "Nut Tool", "Gear Sling", "Runners", "Quick Draws", "Chalk and Chalk Bag", "Rock Shoes", "Belay and Crack Gloves"]),
        glacier: glacier_gear,
        snow: ["Gaiters", "Blue Bag", "Crampons", "Ice Ax", "Helmet",],
      ice: glacier_gear.concat(["Harness", "Helmet", "Ice Screws", "Radios", "Crampons", "Ice Tools"]),
        girl: ["Sport Bra", "Pad / Tampon / Menstural Cup", "Pee Funnel"],
        bear: ["Bear Canister / Ursack", "Bear Spray"],
        ski: avy_gear.concat(["Crampons", "Helmet", "Ski Pack", "Ski Crampons", "Ski Boots", "Skis", "Poles", "Skins", "Skin Wax", "Snow Pants", "Gloves", "Goggles", "Tarp", "Ski Cords"]),
        deep_snow: avy_gear.concat(["Gaiters", "Snowshoes", "Crampons"]),
    };
    let pack_list = packing_list_dict.essentials.concat(packing_list_dict.clothes);

    if (overnight === "yes") {
        pack_list = pack_list.concat(packing_list_dict.overnight);
    }
    if (rock === "yes") {
        pack_list = pack_list.concat(packing_list_dict.rock);
    }
    if (ice === "yes") {
        pack_list = pack_list.concat(packing_list_dict.ice);
    }
    if (ski === "yes") {
        pack_list = pack_list.concat(packing_list_dict.ski);
    }
    if (deep_snow === "yes") {
        pack_list = pack_list.concat(packing_list_dict.deep_snow);
    }
    if (glacier === "yes") {
        pack_list = pack_list.concat(packing_list_dict.glacier);
    }
    if (bear === "yes") {
        pack_list = pack_list.concat(packing_list_dict.bear);
    }
    if (snow === "yes") {
        pack_list = pack_list.concat(packing_list_dict.snow);
    }
    if (gender === "female") {
        pack_list = pack_list.concat(packing_list_dict.girl);
    }

    const unique_pack_list = [...new Set(pack_list)]

    removeForm()

    final_html = "<p>";
    final_html = final_html + make_str(unique_pack_list)
    final_html = final_html + "</p>";
    final_html = final_html + "<p>Optionals: <br> " + make_str(packing_list_dict.optionals) + "</p>";
    result.innerHTML = final_html;


    return final_html
    // result.innerHTML = pack_list.join("\n");
}


