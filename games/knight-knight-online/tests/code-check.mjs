// Join codes: no letters that are easy to mix up, and capitals don't matter
import {makeCode, cleanCode, isCodeLetter, CODE_LENGTH} from "../Online.js";
const banned = "CGUVXWO0I1L";
let ok = true;
const check = (what, good) => { if (!good) { ok = false; console.log("FAIL " + what); } };
for (let i = 0; i < 20000; i++) {
    const code = makeCode();
    check("made " + code, code.length === CODE_LENGTH && ![...code].some(letter => banned.includes(letter)));
}
for (const letter of banned + banned.toLowerCase()) {
    check(letter + " shouldn't be typeable", !isCodeLetter(letter));
}
for (const letter of "abdefhjkmnpqrstyz23456789") {
    check(letter + " should be typeable either way", isCodeLetter(letter) && isCodeLetter(letter.toUpperCase()));
}
check("lowercase code", cleanCode("ab3d") === "AB3D");
check("mixed case code", cleanCode("aB3d") === "AB3D");
check("invite link style", cleanCode("xyz7") === cleanCode("XYZ7"));
console.log(ok ? "PASS" : "FAILED");
process.exit(ok ? 0 : 1);
