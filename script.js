function checkAnswer() {
    const answer = document.getElementById('answer').value;
    const result = document.getElementById('result');

    if (answer === "paris") {
        result.textContent = "Correct!";
    } else {
        result.textContent = "Wrong. Try again!";
    }
}


