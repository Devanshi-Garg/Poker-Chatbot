
import { evaluate } from "./handEvaluator.js";

// Test all 9 poker hand categories
const tests = [
    { name: "Straight Flush", cards: ["9s", "8s", "7s", "6s", "5s", "Ad", "Kc"], expected: 9 },
    { name: "Four of a Kind", cards: ["As", "Ah", "Ad", "Ac", "2s", "3h", "4d"], expected: 8 },
    { name: "Full House", cards: ["Ks", "Kh", "Kd", "2c", "2s", "9h", "3d"], expected: 7 },
    { name: "Flush", cards: ["As", "Js", "9s", "5s", "3s", "Kd", "2c"], expected: 6 },
    { name: "Straight", cards: ["9s", "8h", "7d", "6c", "5s", "Ad", "2h"], expected: 5 },
    { name: "Three of a Kind", cards: ["Qs", "Qh", "Qd", "9s", "5c", "3h", "2d"], expected: 4 },
    { name: "Two Pair", cards: ["Js", "Jh", "8d", "8c", "As", "5h", "2d"], expected: 3 },
    { name: "One Pair", cards: ["As", "Ah", "Kd", "9c", "7h", "4s", "2d"], expected: 2 },
    { name: "High Card", cards: ["As", "Kd", "9c", "7h", "5s", "3d", "2c"], expected: 1 }
];

for (let test of tests) {
    let score = evaluate(test.cards);

    // Extract hand category from scoreHand's numerical score
    let category = Math.floor(score / (15 ** 5));

    if (category === test.expected) {
        console.log("PASS:", test.name);
    } else {
        console.log("FAIL:", test.name,
            "Expected:", test.expected,
            "Got:", category);
    }
}
