// Profile Switcher Logic
function switchProfile(type, event) {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
    
    if(type === 'personal') {
        event.target.classList.add('active');
        document.getElementById('title').innerText = 'Personal Portfolio';
        document.getElementById('subtitle').innerText = 'Poetry, Code, Creative Designs & Mindspace.';
    } else {
        event.target.classList.add('active');
        document.getElementById('title').innerText = 'AR Tech Solutions (Biz)';
        document.getElementById('subtitle').innerText = 'Enterprise Solutions, Development & Digital Empire.';
    }
}

// Login Modal Toggle (Instagram-style soft wall)
function toggleLoginModal(show) {
    const modal = document.getElementById('loginModal');
    modal.style.display = show ? 'flex' : 'none';
}

// Cute AI Dialogue Interactive
const dialogues = [
    "Sugoi! Yeh blue theme mast lag rahi hai! 🔥",
    "Abhi-san, code error free hai na? 😉",
    "Clicking me won't write your code, but it's fun! 🌸",
    "Welcome to arrai.in headquarters! ✨"
];

function interactAI() {
    const speech = document.getElementById('ai-speech');
    const randomMsg = dialogues[Math.floor(Math.random() * dialogues.length)];
    speech.innerText = randomMsg;
}