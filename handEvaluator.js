
const RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
    "7": 7, "8": 8, "9": 9, "T": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14
};

export function evaluate(sevenCards) {

    let bestScore = 0;

    // Try every combination of 5 cards from 7
    for (let a = 0; a < 7; a++) {
        for (let b = a + 1; b < 7; b++) {
            for (let c = b + 1; c < 7; c++) {
                for (let d = c + 1; d < 7; d++) {
                    for (let e = d + 1; e < 7; e++) {

                        let fiveCards = [
                            sevenCards[a],
                            sevenCards[b],
                            sevenCards[c],
                            sevenCards[d],
                            sevenCards[e]
                        ];

                        let score = evaluateFiveCards(fiveCards);

                        if (score > bestScore) {
                            bestScore = score;
                        }
                    }
                }
            }
        }
    }

    return bestScore;
}

function evaluateFiveCards(cards) {

    // Get ranks and suits of all 5 cards
    let ranks = cards.map(card => RANK_VALUES[card[0]]);
    let suits = cards.map(card => card[1]);

    // Sort ranks from highest to lowest
    ranks.sort((a, b) => b - a);

    // Count how many times each rank appears
    let rankCounts = {};

    for (let rank of ranks) {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    }

    // Check if all 5 cards have the same suit
    let isFlush = suits.every(suit => suit === suits[0]);

    // Check if all 5 ranks are consecutive
    let isStraight =
        (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) ||
        JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2]);

    // Find ranks that appear 4, 3, or 2 times
    let fourRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 4);
    let threeRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 3);
    let pairRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 2);

    // Handle Ace-low straight (A, 5, 4, 3, 2)
    let straightHigh = (
        ranks[0] === 14 && ranks[1] === 5
    ) ? 5 : ranks[0];

    // Straight Flush
    if (isFlush && isStraight) {
        return scoreHand(9, [straightHigh]);
    }

    // Four of a Kind
    else if (fourRank !== undefined) {
        let kicker = ranks.find(rank => rank !== Number(fourRank));
        return scoreHand(8, [Number(fourRank), kicker]);
    }

    // Full House
    else if (threeRank !== undefined && pairRank !== undefined) {
        return scoreHand(7, [Number(threeRank), Number(pairRank)]);
    }

    // Flush
    else if (isFlush) {
        return scoreHand(6, ranks);
    }

    // Straight
    else if (isStraight) {
        return scoreHand(5, [straightHigh]);
    }

    // Three of a Kind
    else if (threeRank !== undefined) {
        let kickers = ranks.filter(rank => rank !== Number(threeRank));
        return scoreHand(4, [Number(threeRank), ...kickers]);
    }

    // Two Pair
    else if (Object.values(rankCounts).filter(count => count === 2).length === 2) {
        let pairs = Object.keys(rankCounts)
            .filter(rank => rankCounts[rank] === 2)
            .map(Number)
            .sort((a, b) => b - a);

        let kicker = ranks.find(rank => !pairs.includes(rank));

        return scoreHand(3, [...pairs, kicker]);
    }

    // One Pair
    else if (pairRank !== undefined) {
        let kickers = ranks.filter(rank => rank !== Number(pairRank));
        return scoreHand(2, [Number(pairRank), ...kickers]);
    }

    // High Card
    else {
        return scoreHand(1, ranks);
    }// Continue with the remaining poker hands below

}

function scoreHand(category, kickers) {
    let score = category;

    for (let i = 0; i < 5; i++) {
        score = score * 15 + (kickers[i] || 0);
    }

    return score;
}