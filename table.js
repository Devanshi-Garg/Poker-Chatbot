// table.js
// Draws the seats around the table and the poker chips on the felt.
//   - one seat per opponent (1-8): a chair beside the table, two face-down cards and a name tag
//   - your own chair at the bottom, behind your two cards
//   - if there is an amount to call, each opponent has that bet in chips in front of them
//     (everyone still in has matched the bet, the same assumption the advice uses)
//   - the pot sits in the middle as chips
//
// script.js calls renderTableSeats(...) whenever the opponents, pot or call amount change.

const CARD_BACK = 'card-images/Back-R.png';

// Seat spots as % of the table (x from the left, y from the top), on the table's edge.
// The side seats sit below the board so the community cards have room.
const SPOTS = {
    BL: [14, 95], L: [0, 63], TL: [14, 5], TC1: [35, 0], TC: [50, 0],
    TC2: [65, 0], TR: [86, 5], R: [100, 63], BR: [86, 95]
};
const YOU = [50, 100];

// Corner seats push their bet a bit further in, so the chips don't cover their name tag
const REACH = { TL: 1.35, TR: 1.35, BL: 1.2, BR: 1.2 };

// Which spots to use for each number of opponents, clockwise from your left
const LAYOUTS = {
    1: ['TC'],
    2: ['TL', 'TR'],
    3: ['L', 'TC', 'R'],
    4: ['L', 'TL', 'TR', 'R'],
    5: ['L', 'TL', 'TC', 'TR', 'R'],
    6: ['BL', 'L', 'TL', 'TR', 'R', 'BR'],
    7: ['BL', 'L', 'TL', 'TC', 'TR', 'R', 'BR'],
    8: ['BL', 'L', 'TL', 'TC1', 'TC2', 'TR', 'R', 'BR']
};

// Casino chip colours by value
const CHIP_VALUES = [
    [500, 'purple'], [100, 'black'], [25, 'green'], [5, 'red'], [1, 'white']
];

// Turns a dollar amount into a few chip stacks, biggest chips first, e.g. $150 -> 1 black + 2 green
export function chipStacks(amount, maxStacks = 3, maxPerStack = 6) {
    let left = Math.max(0, Math.round(Number(amount) || 0));
    const stacks = [];
    for (const [value, color] of CHIP_VALUES) {
        const count = Math.floor(left / value);
        if (count > 0) {
            stacks.push({ color, count: Math.min(count, maxPerStack) });
            left -= count * value;
        }
    }
    return stacks.slice(0, maxStacks);
}

function stacksHtml(amount, maxStacks) {
    return chipStacks(amount, maxStacks)
        .map(({ color, count }) =>
            `<span class="stack" style="--count:${count}">` +
            Array.from({ length: count }, (_, i) => `<span class="chip chip-${color}" style="--i:${i}"></span>`).join('') +
            `</span>`)
        .join('');
}

const money = (n) => `$${Number.isInteger(n) ? n : Number(n).toFixed(2)}`;

// Direction from a spot toward the middle of the table (the table is ~1.37x wider than tall),
// plus the angle that turns a chair to face the table
function towardCenter(x, y) {
    const vx = (50 - x) * 1.37, vy = 50 - y;
    const len = Math.hypot(vx, vy) || 1;
    const dx = vx / len, dy = vy / len;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
    return { dx, dy, angle };
}

function seatStyle(x, y, reach = 1) {
    const { dx, dy, angle } = towardCenter(x, y);
    return `--x:${x}; --y:${y}; --dx:${(dx * reach).toFixed(3)}; --dy:${(dy * reach).toFixed(3)}; ` +
           `--ox:${dx.toFixed(3)}; --oy:${dy.toFixed(3)}; --angle:${angle.toFixed(1)}deg`;
}

export function renderTableSeats({ opponents, pot, call }) {
    const seatsEl = document.getElementById('seats');
    const potChipsEl = document.getElementById('potChips');
    if (!seatsEl) return;

    const count = Math.min(8, Math.max(1, parseInt(opponents, 10) || 1));
    const bet = Number(call) > 0 ? Number(call) : 0;

    const opponentSeats = LAYOUTS[count].map((spot, i) => {
        const [x, y] = SPOTS[spot];
        return `
            <div class="seat" style="${seatStyle(x, y, REACH[spot] || 1)}">
                <span class="chair" aria-hidden="true"></span>
                <div class="seat-cards">
                    <img src="${CARD_BACK}" alt="" draggable="false">
                    <img src="${CARD_BACK}" alt="" draggable="false">
                </div>
                <span class="seat-name"><span class="long">Player </span>${i + 1}</span>
                ${bet > 0 ? `<div class="bet"><span class="stacks">${stacksHtml(bet, 2)}</span><span class="bet-amount">${money(bet)}</span></div>` : ''}
            </div>`;
    }).join('');

    const yourSeat = `
            <div class="seat seat-you" style="${seatStyle(YOU[0], YOU[1])}">
                <span class="chair" aria-hidden="true"></span>
                <span class="seat-name">You</span>
            </div>`;

    seatsEl.innerHTML = opponentSeats + yourSeat;
    seatsEl.setAttribute('aria-label',
        `${count} opponent${count === 1 ? '' : 's'}` + (bet > 0 ? `, each betting ${money(bet)}` : ''));

    if (potChipsEl) potChipsEl.innerHTML = stacksHtml(pot, 3);
}
