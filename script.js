function checkAnswer() {
    const overnight = document.getElementById('overnight').value;
    const rock = document.getElementById('rock').value;
    const result = document.getElementById('result');

    let pack_list = [];

    if (overnight === "yes") {
        pack_list = pack_list.concat(["Tent"]);
    }
    if (rock == "yes") {
        pack_list = pack_list.concat(["Harness"]);
    }

    result.textContent = pack_list.join("\n");
}


