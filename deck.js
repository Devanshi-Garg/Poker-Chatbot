export function createDeck() {
    const suits = ["s", "h", "d", "c"]; // Spades, Hearts, Diamonds, Clubs
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

    let deck = [];

    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push(rank + suit);
        }
    }

    return deck;
}

export function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));

        // Swap the cards at positions i and j
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}