import { createDeck, shuffle } from "./deck.js";
import { evaluate } from "./handEvaluator.js";

const ITERATIONS = 10000;

export function monteCarlo(myCards, communityCards, numOpponents) {

    // Validate inputs
    if (myCards.length !== 2) {
        throw new Error("You must have exactly 2 cards.");
    }

    if (communityCards.length > 5) {
        throw new Error("There cannot be more than 5 community cards.");
    }

    if (!Number.isInteger(numOpponents) ||
        numOpponents < 1 || numOpponents > 9) {
        throw new Error("Number of opponents must be between 1 and 9.");
    }

// Check for invalid or duplicate known cards
    let knownCards = [...myCards, ...communityCards];
    let validCards = new Set(createDeck());

    if (knownCards.some(card => !validCards.has(card)) ||
        new Set(knownCards).size !== knownCards.length) {
        throw new Error("Invalid or duplicate cards detected.");
    }

    let wins = 0;
    let ties = 0;

    // Repeat simulation 10000 times
    for (let i = 0; i < ITERATIONS; i++) {

        // Step 1: Create a fresh deck
        let deck = createDeck();

        // Step 2: Remove all known cards
        deck = deck.filter(card =>
            !myCards.includes(card) && !communityCards.includes(card)
        );

        // Step 3: Shuffle remaining deck
        shuffle(deck);

        // Step 4: Give opponents random cards first
        let opponents = [];

        for (let j = 0; j < numOpponents; j++) {
            let opponentCards = [deck.pop(), deck.pop()];
            opponents.push(opponentCards);
        }

        // Step 5: Generate missing community cards
        let board = [...communityCards];

        while (board.length < 5) {
            let card = deck.pop();
            board.push(card);
        }

        // Step 6: Evaluate everyone's hand
        let myScore = evaluate([...myCards, ...board]);

        let opponentScores = [];

        for (let opponent of opponents) {
            let score = evaluate([...opponent, ...board]);
            opponentScores.push(score);
        }

        // Step 7: Determine winner
        let highestOpponentScore = Math.max(...opponentScores);

        if (myScore > highestOpponentScore) {
            wins++;
        }

        else if (myScore === highestOpponentScore) {
            ties++;
        }
    }

    // Step 8: Calculate probabilities
    let winProbability = (wins / ITERATIONS) * 100;
    let tieProbability = (ties / ITERATIONS) * 100;

    return { winProbability, tieProbability };
}