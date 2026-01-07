// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainNav = document.getElementById('mainNav');

if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', function() {
        mainNav.style.display = mainNav.style.display === 'block' ? 'none' : 'block';
        this.innerHTML = mainNav.style.display === 'block' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
}

// Header Scroll Effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('.site-header');
    if (header) {
        if (window.scrollY > 100) {
            header.style.padding = '10px 0';
            header.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.08)';
        } else {
            header.style.padding = '15px 0';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.05)';
        }
    }
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if(targetId === '#') return;
        const targetElement = document.querySelector(targetId);
        if(targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
            // Close mobile menu if open
            if(window.innerWidth <= 768 && mainNav) {
                mainNav.style.display = 'none';
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }
    });
});

// See More/Less Feature for About Me
const readMoreBtn = document.getElementById('readMoreBtn');
const truncatedText = document.getElementById('truncatedText');
let isExpanded = false;

if (readMoreBtn && truncatedText) {
    readMoreBtn.addEventListener('click', function() {
        isExpanded = !isExpanded;
        
        if (isExpanded) {
            truncatedText.classList.add('expanded');
            this.innerHTML = '<span>Read Less</span> <i class="fas fa-chevron-up"></i>';
        } else {
            truncatedText.classList.remove('expanded');
            this.innerHTML = '<span>Read More</span> <i class="fas fa-chevron-down"></i>';
        }
    });
}

// Animate stats counter on scroll
const statNumbers = document.querySelectorAll('.stat-number');
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target;
            const targetNumber = parseInt(statNumber.textContent.replace('+', ''));
            let currentNumber = 0;
            const increment = targetNumber / 50;
            const timer = setInterval(() => {
                currentNumber += increment;
                if (currentNumber >= targetNumber) {
                    statNumber.textContent = targetNumber + '+';
                    clearInterval(timer);
                } else {
                    statNumber.textContent = Math.floor(currentNumber) + '+';
                }
            }, 30);
            observer.unobserve(statNumber);
        }
    });
}, observerOptions);

statNumbers.forEach(statNumber => {
    observer.observe(statNumber);
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Lazy loading for images
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
});

// Add loading class for CSS transitions
document.body.classList.add('loaded');