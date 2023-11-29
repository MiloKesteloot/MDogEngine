function urlSetup() {
    const urlParams = new URLSearchParams(window.location.search);
    let playingValue = urlParams.get('game');

    if (playingValue == null) {
        document.body.innerHTML += "<h1>No game cart inserted.<br>Please put '?game=gamename' after the url.</h1>"
        return;
    }



    // if (!playingValue.endsWith(".js")) {
    //     playingValue += ".js";
    // }

    console.log("Loading game games/" + playingValue + "/" + playingValue + ".js ...");

    let scriptElement = document.createElement('script');

    // Set the type and source attributes
    scriptElement.type = 'module';
    scriptElement.src = 'games/' + playingValue + "/" + playingValue + ".js";

    // Append the script element to the body
    document.body.appendChild(scriptElement);

    document.body.style.display = "flex";
    document.body.style.justifyContent = "center";
    document.body.style.alignItems = "center";
    document.body.style.height = "100vh";
    document.body.style.margin = "0px";

}

urlSetup();