// poker-strategy-engine.js

export const SUITS = ['s', 'h', 'd', 'c'];
export const RANKS = [
  '2', '3', '4', '5', '6', '7', '8',
  '9', 'T', 'J', 'Q', 'K', 'A'
];

const RANK_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14
};

/**
 * Converts a card rank into its numerical value.
 */
function getRankValue(rank) {
  return RANK_VALUES[rank] ?? Number(rank);
}

/**
 * Scores exactly five poker cards.
 *
 * Score categories:
 * 8 = Straight Flush
 * 7 = Four of a Kind
 * 6 = Full House
 * 5 = Flush
 * 4 = Straight
 * 3 = Three of a Kind
 * 2 = Two Pair
 * 1 = One Pair
 * 0 = High Card
 */
export function score5CardHand(cards) {
  const hand = cards
    .map(card => ({
      rank: getRankValue(card.r),
      suit: card.s
    }))
    .sort((a, b) => b.rank - a.rank);

  const ranks = hand.map(card => card.rank);
  const suits = hand.map(card => card.suit);

  const isFlush = suits.every(suit => suit === suits[0]);

  let isStraight = false;
  let straightHigh = 0;

  const uniqueRanks = [...new Set(ranks)];

  if (
    uniqueRanks.length === 5 &&
    ranks[0] - ranks[4] === 4
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    // Ace-low wheel: A-2-3-4-5
    isStraight = true;
    straightHigh = 5;
  }

  const rankCounts = {};

  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });

  const groups = Object.entries(rankCounts)
    .map(([rank, count]) => ({
      rank: Number(rank),
      count
    }))
    .sort((a, b) => {
      return b.count - a.count || b.rank - a.rank;
    });

  let category;

  if (isStraight && isFlush) {
    category = 8;
  } else if (groups[0].count === 4) {
    category = 7;
  } else if (
    groups[0].count === 3 &&
    groups[1]?.count === 2
  ) {
    category = 6;
  } else if (isFlush) {
    category = 5;
  } else if (isStraight) {
    category = 4;
  } else if (groups[0].count === 3) {
    category = 3;
  } else if (
    groups[0].count === 2 &&
    groups[1]?.count === 2
  ) {
    category = 2;
  } else if (groups[0].count === 2) {
    category = 1;
  } else {
    category = 0;
  }

  let tiebreaker = 0;

  if (category === 8 || category === 4) {
    tiebreaker = straightHigh;
  } else {
    groups.forEach((group, index) => {
      tiebreaker += group.rank * Math.pow(15, 4 - index);
    });
  }

  return category * 1_000_000 + tiebreaker;
}

/**
 * Evaluates the best five-card poker hand from up to seven cards.
 */
export function evaluate7CardHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5) {
    throw new Error('At least five cards are required to evaluate a hand.');
  }

  let bestScore = -1;

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const combination = [
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e]
            ];

            const score = score5CardHand(combination);

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

/**
 * Creates a fresh deck excluding known cards.
 */
export function createRemainingDeck(knownCards = []) {
  return RANKS.flatMap(rank =>
    SUITS
      .filter(suit => {
        return !knownCards.some(
          card => card.r === rank && card.s === suit
        );
      })
      .map(suit => ({ r: rank, s: suit }))
  );
}

/**
 * Fisher-Yates shuffle.
 */
export function shuffleCards(cards) {
  const shuffled = [...cards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i]
    ];
  }

  return shuffled;
}

/**
 * Determines the recommended poker action from the calculated equity.
 */
export function determineRecommendedAction({
  winPct,
  totalEquityPct,
  potOdds,
  callAmount,
  opponents
}) {
  let action = 'CHECK / CALL';

  if (callAmount === 0) {
    const requiredWinRate = 100 / (opponents + 1);

    if (winPct > requiredWinRate + 15) {
      action = 'BET / RAISE';
    } else {
      action = 'CHECK';
    }

    return action;
  }

  if (totalEquityPct > potOdds + 12) {
    action = 'RAISE / RE-RAISE';
  } else if (totalEquityPct >= potOdds) {
    action = 'CALL';
  } else {
    action = 'FOLD';
  }

  return action;
}

/**
 * Runs a Monte Carlo Texas Hold'em simulation.
 *
 * Input format:
 * {
 *   hole: [
 *     { r: 'A', s: 's' },
 *     { r: 'K', s: 's' }
 *   ],
 *   board: [
 *     { r: 'T', s: 's' },
 *     { r: '4', s: 's' },
 *     { r: '2', s: 'h' },
 *     null,
 *     null
 *   ],
 *   opponents: 2,
 *   pot: 200,
 *   callAmount: 60
 * }
 */
export function runMonteCarloSimulation(gameState, iterations = 5000) {
  const {
    hole,
    board,
    opponents = 1,
    pot = 0,
    callAmount = 0
  } = gameState;

  if (
    !Array.isArray(hole) ||
    hole.length !== 2 ||
    hole.some(card => !card)
  ) {
    throw new Error('Two hole cards are required.');
  }

  if (!Array.isArray(board) || board.length !== 5) {
    throw new Error('The board must contain five positions.');
  }

  if (opponents < 1) {
    throw new Error('At least one opponent is required.');
  }

  const knownCards = [
    ...hole,
    ...board.filter(Boolean)
  ];

  const deck = createRemainingDeck(knownCards);

  const activeBoardCards = board.filter(Boolean);
  const missingBoardCount = 5 - activeBoardCards.length;

  let wins = 0;
  let ties = 0;
  let losses = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const shuffledDeck = shuffleCards(deck);

    let deckIndex = 0;

    const simulatedBoard = [...activeBoardCards];

    for (let i = 0; i < missingBoardCount; i++) {
      simulatedBoard.push(shuffledDeck[deckIndex++]);
    }

    const playerScore = evaluate7CardHand([
      ...hole,
      ...simulatedBoard
    ]);

    let bestOpponentScore = -1;

    for (let opponent = 0; opponent < opponents; opponent++) {
      const opponentHoleCards = [
        shuffledDeck[deckIndex++],
        shuffledDeck[deckIndex++]
      ];

      const opponentScore = evaluate7CardHand([
        ...opponentHoleCards,
        ...simulatedBoard
      ]);

      if (opponentScore > bestOpponentScore) {
        bestOpponentScore = opponentScore;
      }
    }

    if (playerScore > bestOpponentScore) {
      wins++;
    } else if (playerScore === bestOpponentScore) {
      ties++;
    } else {
      losses++;
    }
  }

  const winPct = (wins / iterations) * 100;
  const tiePct = (ties / iterations) * 100;
  const lossPct = (losses / iterations) * 100;

  const potOdds = callAmount > 0
    ? (callAmount / (pot + callAmount)) * 100
    : 0;

  const totalEquityPct = winPct + tiePct / 2;
  const totalEquityFraction = totalEquityPct / 100;

  const expectedValue = callAmount > 0
    ? totalEquityFraction * (pot + callAmount) - callAmount
    : totalEquityFraction * pot;

  const action = determineRecommendedAction({
    winPct,
    totalEquityPct,
    potOdds,
    callAmount,
    opponents
  });

  return {
    iterations,
    wins,
    ties,
    losses,
    winPct,
    tiePct,
    lossPct,
    totalEquityPct,
    potOdds,
    expectedValue,
    action
  };
}
