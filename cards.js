// cards.js
// Shows each playing card as an image from the "card-images" folder.
// File names in that folder: suit letter + number, e.g.
//   S-1.png  = Ace of spades      H-11.png = Jack of hearts
//   D-10.png = 10 of diamonds     C-13.png = King of clubs
//
// Usage (already wired into script.js):
//   element.innerHTML = renderCardContent('A', 's');
//   ranks: '2'-'9', 'T', 'J', 'Q', 'K', 'A'     suits: 's', 'h', 'd', 'c'

const IMAGE_FOLDER = 'card-images';

const SUIT_LETTER = { s: 'S', h: 'H', d: 'D', c: 'C' };
const RANK_NUMBER = { A: 1, T: 10, J: 11, Q: 12, K: 13 }; // 2-9 use their own number

const RANK_NAMES = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };
const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };

// e.g. cardImageUrl('A', 's') -> "card-images/S-1.png"
export function cardImageUrl(rank, suit) {
  const number = RANK_NUMBER[rank] ?? Number(rank);
  return `${IMAGE_FOLDER}/${SUIT_LETTER[suit]}-${number}.png`;
}

export function renderCardContent(rank, suit) {
  const label = `${RANK_NAMES[rank] || rank} of ${SUIT_NAMES[suit] || suit}`;
  // object-fit: contain = the whole card always shows, never cropped, whatever the slot size
  return `<img src="${cardImageUrl(rank, suit)}" alt="${label}" draggable="false"
              style="width:100%;height:100%;object-fit:contain;display:block">`;
}
