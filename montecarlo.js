function monteCarlo(myCards, communityCards, numOpponents) {

    let wins = 0;

    for (let i = 0; i < 5000; i++) {

        // Create a new deck excluding known cards
        let deck = createDeck();
        deck = deck.filter(card =>
            !myCards.includes(card) && !communityCards.includes(card)
        );
        shuffle(deck);

        // Randomly deal missing community cards
        let board = [...communityCards];

        while (board.length < 5) {
            board.push(deck.pop());
        }

        // Randomly deal cards to opponents
        let opponents = [];

        for (let j = 0; j < numOpponents; j++) {
            let opponentCards = [deck.pop(), deck.pop()];
            opponents.push(opponentCards);
        }

        // Determine who has the strongest poker hand
        let myHand = evaluate([...myCards, ...board]);

        let opponentHands = opponents.map(opponent =>
            evaluate([...opponent, ...board])
        );

        // Count win only if we beat every opponent
        if (opponentHands.every(hand => myHand > hand)) {
            wins++;
        }
    }

    let winProbability = wins / 5000 * 100;

    return winProbability;
}
