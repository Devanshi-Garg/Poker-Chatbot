
import { monteCarlo } from "./monteCarlo.js";
import assert from "node:assert/strict";

// Test 1: Guaranteed win (Royal Flush)
let result1 = monteCarlo(
    ["As", "Ks"],
    ["Qs", "Js", "Ts", "2d", "3c"],
    1
);

console.log("Test 1 - Guaranteed Win:", result1);

assert.equal(result1.winProbability, 100);
assert.equal(result1.tieProbability, 0);


// Test 2: Guaranteed tie (Royal Flush on board)
let result2 = monteCarlo(
    ["2d", "3c"],
    ["As", "Ks", "Qs", "Js", "Ts"],
    2
);

console.log("Test 2 - Guaranteed Tie:", result2);

assert.equal(result2.winProbability, 0);
assert.equal(result2.tieProbability, 100);


// Test 3: Pre-flop simulation
let result3 = monteCarlo(
    ["As", "Kh"],
    [],
    1
);

console.log("Test 3 - Pre-flop:", result3);


// Test 4: Two opponents
let result4 = monteCarlo(
    ["As", "Kh"],
    ["Qs", "Jh", "2d"],
    2
);

console.log("Test 4 - Two Opponents:", result4);


// Check that all probabilities are valid
for (let result of [result1, result2, result3, result4]) {
    assert.ok(result.winProbability >= 0);
    assert.ok(result.tieProbability >= 0);
    assert.ok(result.winProbability + result.tieProbability <= 100);
}

console.log("All Monte Carlo tests passed!");
