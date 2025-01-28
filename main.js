function urlSetup() {
    const urlParams = new URLSearchParams(window.location.search);

    let playingValue = urlParams.get('game');
    urlParams.set('game2', "thing");

    const games = ["hard-to-convey-level-editor", "snack-man", "wavefunctioncollapse", "joust", "sofiatale", "side", "publicfaith", "cards", "glory"];

    if (playingValue == null || !games.includes(playingValue)) {
        document.body.innerHTML += "<h1>No game cart inserted.<br>Please put '?game=gamename' after the url.</h1>"

        games.forEach(game => {
            const button = document.createElement('button');
            button.innerText = game;
            button.addEventListener('click', () => {
                let href = window.location.href;
                if (href.includes("?")) {
                    window.location.href = window.location.href + "&game=" + game;
                } else {
                    window.location.href = window.location.href + "?game=" + game;
                }
            });
            document.body.appendChild(button);
        });

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