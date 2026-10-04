/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   Snack Man Remastered - typing a name for the scoreboard            ║
 * ║   This file was written by Claude (Anthropic's AI).                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import {cleanName, MAX_NAME_LENGTH} from "./Scoreboard.js";

// An invisible text box on the page that the game draws in its own pixel font. A real text box is needed
// so phones open their keyboard, and phones only do that when it's focused during a tap, so while it's
// open, any tap on the screen focuses it.
class NameInput {
    constructor() {
        this.isOpen = false;
        this.submitted = false;
        this.usingTouch = false;
        window.addEventListener("touchstart", () => this.usingTouch = true);
        window.addEventListener("keydown", () => this.usingTouch = false);

        const element = document.createElement("input");
        element.type = "text";
        element.maxLength = MAX_NAME_LENGTH;
        element.autocomplete = "off";
        element.spellcheck = false;
        element.setAttribute("autocapitalize", "characters");
        element.setAttribute("enterkeyhint", "done");
        // Invisible, but still focusable. 16px text stops iPhones from zooming in when it's focused.
        Object.assign(element.style, {
            position: "fixed", left: "0", top: "0", width: "1px", height: "1px",
            opacity: "0", border: "0", padding: "0", fontSize: "16px", display: "none"
        });
        document.body.appendChild(element);
        this.element = element;

        element.addEventListener("input", () => {
            element.value = cleanName(element.value);
        });
        element.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                this.submitted = true;
                e.preventDefault();
            }
            // MDog stops the space bar's normal effect (so it can't scroll the page), which also stops it
            // typing into the box, so it's typed here instead
            if (e.code === "Space" && element.value.length < MAX_NAME_LENGTH) {
                element.value = cleanName(element.value + " ");
            }
        });
        // Phones' "done" button sometimes only shows up as a change, not as an Enter key. (On a computer a
        // change also happens when you click away, so this is only for touch screens.)
        element.addEventListener("change", () => {
            if (this.isOpen && this.usingTouch) {
                this.submitted = true;
            }
        });

        window.addEventListener("touchend", () => {
            if (this.isOpen) {
                element.focus();
            }
        });
    }

    open(name) {
        this.isOpen = true;
        this.submitted = false;
        this.element.value = cleanName(name ?? "");
        this.element.style.display = "block";
        this.element.focus(); // works straight away on computers; phones wait for a tap
    }

    close() {
        this.isOpen = false;
        this.element.blur();
        this.element.style.display = "none";
    }

    // Keeps typing going to the box on computers, even if the page was clicked
    keepFocus() {
        if (this.isOpen && document.activeElement !== this.element) {
            this.element.focus();
        }
    }

    hasFocus() {
        return document.activeElement === this.element;
    }

    value() {
        return cleanName(this.element.value);
    }

    // True once each time Enter (or the phone's "done") is pressed
    takeSubmit() {
        const submitted = this.submitted;
        this.submitted = false;
        return submitted;
    }
}

export default NameInput;
