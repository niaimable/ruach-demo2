// ===== PRELOADER =====
function hidePreloader() {
    const p = document.getElementById('preloader');
    if (p) p.classList.add('hidden');
}
window.addEventListener('load', () => setTimeout(hidePreloader, 400));
setTimeout(hidePreloader, 2500);

// ===== MOBILE MENU =====
const menuBtn = document.getElementById('menu-btn');
const mainNav = document.getElementById('main-nav');

if (menuBtn && mainNav) {
    menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = mainNav.classList.toggle('open');
        this.innerHTML = isOpen
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
    });
    document.addEventListener('click', function (e) {
        if (!mainNav.contains(e.target) && !menuBtn.contains(e.target)) {
            mainNav.classList.remove('open');
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
}

// ===== HEADER SCROLL =====
const header = document.getElementById('site-header');
window.addEventListener('scroll', function () {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
        if (mainNav) {
            mainNav.classList.remove('open');
            if (menuBtn) menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
});

// ===== READ MORE =====
const readMoreBtn = document.getElementById('readMoreBtn');
const aboutText = document.getElementById('aboutText');
if (readMoreBtn && aboutText) {
    readMoreBtn.addEventListener('click', function () {
        const expanded = aboutText.classList.toggle('expanded');
        this.innerHTML = expanded
            ? '<span>Read Less</span> <i class="fas fa-chevron-up"></i>'
            : '<span>Read More</span> <i class="fas fa-chevron-down"></i>';
    });
}

// ===== PWA SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}