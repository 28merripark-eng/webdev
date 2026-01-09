const surpriseBtn = document.getElementById('surpriseBtn');
const resetBtn = document.getElementById('resetBtn');
const contentArea = document.getElementById('contentArea');

const ideas = [
    { title: 'Tiny poem', text: 'Roses are red, this page is bare — you found it and stared.' },
    { title: 'Random tip', text: 'Add a photo, a joke, or your favorite playlist to fix boredom.' },
    { title: 'Micro game', text: 'Try tapping the button rapidly — see what happens.' },
    { title: 'Quote', text: '“Empty pages are invitations.” — a friendly internet citizen.' },
    { title: 'Easter egg', text: 'Surprise! You clicked. Now the page has something.' }
];

let lastIndex = -1;

function pickIdea() {
    let i = Math.floor(Math.random() * ideas.length);
    if (i === lastIndex) { i = (i + 1) % ideas.length }
    lastIndex = i;
    return ideas[i];
}

function showIdea() {
    const idea = pickIdea();
    contentArea.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('div');
    title.className = 'idea';
    title.textContent = idea.title;
    const text = document.createElement('div');
    text.className = 'small';
    text.textContent = idea.text;
    card.appendChild(title);
    card.appendChild(text);
    contentArea.appendChild(card);
}

surpriseBtn.addEventListener('click', () => {
    showIdea();
    surpriseBtn.textContent = 'Give me another';
});

resetBtn.addEventListener('click', () => {
    contentArea.innerHTML = '';
    surpriseBtn.textContent = 'Give me something';
});

// keyboard shortcut: press Space to get something
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        showIdea();
    }
});
