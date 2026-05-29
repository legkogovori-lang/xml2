// Supabase конфигурация
const SUPABASE_URL = 'https://fllzqyxakrjwqdudndsu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zLJTwgWmldicE9FydB0Xgg_2BmxmgbB';

// Инициализация Supabase клиента
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Функция для хеширования пароля (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Элементы DOM
const goToAppBtn = document.getElementById('goToAppBtn');
const authModal = document.getElementById('authModal');
const privacyModal = document.getElementById('privacyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelAuthBtn = document.getElementById('cancelAuthBtn');
const loginBtn = document.getElementById('loginBtn');
const demoBtn = document.getElementById('demoBtn');
const privacyPolicyBtn = document.getElementById('privacyPolicyBtn');
const closePrivacyModal = document.getElementById('closePrivacyModal');
const closePrivacyBtn = document.getElementById('closePrivacyBtn');
const loginInput = document.getElementById('loginInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');

// Функция проверки срока действия пароля
function isPasswordExpired(expiresAt) {
    if (!expiresAt) return false;
    const expireDate = new Date(expiresAt);
    const today = new Date();
    return today > expireDate;
}

// Функция проверки авторизации через Supabase
async function checkAuth(role = null) {
    // ДЕМО РЕЖИМ - НЕ проверяем в Supabase
    if (role === 'demo') {
        closeAuthModal();
        const userData = {
            login: 'demo',
            role: 'demo',
            displayName: 'Демо-режим',
            isDemo: true
        };
        sessionStorage.setItem('etrn_user', JSON.stringify(userData));
        window.location.href = 'app.html';
        return true;
    }
    
    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login || !password) {
        authError.textContent = 'Введите логин и пароль';
        return false;
    }

    const originalBtnText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Проверка...';
    loginBtn.disabled = true;

    try {
        // Ищем пользователя в Supabase
        const { data: users, error } = await supabaseClient
            .from('etrnusers')
            .select('*')
            .eq('name', login)
            .eq('active', true)
            .limit(1);

        if (error) {
            console.error('Ошибка запроса к Supabase:', error);
            authError.textContent = 'Ошибка соединения с сервером';
            return false;
        }

        if (!users || users.length === 0) {
            authError.textContent = 'Неверный логин или пароль';
            passwordInput.value = '';
            passwordInput.focus();
            return false;
        }

        const user = users[0];

        // Проверяем пароль через хеш
        const hashedInputPassword = await hashPassword(password);
        
        // Сравниваем с хешем в БД (поддержка старого формата)
        let isPasswordValid = false;
        if (user.password_hash) {
            isPasswordValid = (hashedInputPassword === user.password_hash);
        } else if (user.password) {
            // Обратная совместимость
            isPasswordValid = (user.password === password);
        }

        if (!isPasswordValid) {
            authError.textContent = 'Неверный логин или пароль';
            passwordInput.value = '';
            passwordInput.focus();
            return false;
        }

        // Проверка срока действия
        if (isPasswordExpired(user.expires_at)) {
            authError.textContent = `Срок действия пароля истёк. Доступ был до ${user.expires_at}`;
            passwordInput.value = '';
            passwordInput.focus();
            return false;
        }

        closeAuthModal();
        
        const userData = {
            id: user.id,
            login: user.name,
            role: user.role || 'full',
            displayName: user.display_name || user.name,
            expiresAt: user.expires_at,
            isDemo: false
        };
        sessionStorage.setItem('etrn_user', JSON.stringify(userData));
        
        window.location.href = 'app.html';
        return true;

    } catch (err) {
        console.error('Ошибка авторизации:', err);
        authError.textContent = 'Ошибка соединения с сервером';
        return false;
    } finally {
        loginBtn.innerHTML = originalBtnText;
        loginBtn.disabled = false;
    }
}

// Остальные функции без изменений...
function openAuthModal() {
    authModal.style.display = 'flex';
    loginInput.value = '';
    passwordInput.value = '';
    authError.textContent = '';
    setTimeout(() => loginInput.focus(), 100);
}

function closeAuthModal() {
    authModal.style.display = 'none';
    authError.textContent = '';
}

function openPrivacyModal() {
    privacyModal.style.display = 'flex';
}

function closePrivacyModalFunc() {
    privacyModal.style.display = 'none';
}

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        checkAuth();
    }
}

function setupInfiniteScroll() {
    const xmlContainer = document.getElementById('scrollingXml');
    if (!xmlContainer) return;
    const originalContent = xmlContainer.innerHTML;
    xmlContainer.innerHTML = originalContent + originalContent;
}

function setupScrollAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.feature-card, .step-card').forEach(el => {
        observer.observe(el);
    });
}

function setupXmlHover() {
    const xmlWrapper = document.querySelector('.preview-xml-wrapper');
    const xmlContent = document.getElementById('scrollingXml');
    if (xmlWrapper && xmlContent) {
        xmlWrapper.addEventListener('mouseenter', () => {
            xmlContent.style.animationPlayState = 'paused';
        });
        xmlWrapper.addEventListener('mouseleave', () => {
            xmlContent.style.animationPlayState = 'running';
        });
    }
}

goToAppBtn.addEventListener('click', openAuthModal);
closeModalBtn.addEventListener('click', closeAuthModal);
cancelAuthBtn.addEventListener('click', closeAuthModal);
loginBtn.addEventListener('click', () => checkAuth());
if (demoBtn) demoBtn.addEventListener('click', () => checkAuth('demo'));
loginInput.addEventListener('keypress', handleKeyPress);
passwordInput.addEventListener('keypress', handleKeyPress);

if (privacyPolicyBtn) {
    privacyPolicyBtn.addEventListener('click', openPrivacyModal);
}
if (closePrivacyModal) {
    closePrivacyModal.addEventListener('click', closePrivacyModalFunc);
}
if (closePrivacyBtn) {
    closePrivacyBtn.addEventListener('click', closePrivacyModalFunc);
}

window.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
    if (e.target === privacyModal) closePrivacyModalFunc();
});

document.addEventListener('DOMContentLoaded', () => {
    setupInfiniteScroll();
    setupScrollAnimation();
    setupXmlHover();
    const hero = document.querySelector('.hero');
    if (hero) hero.style.opacity = '1';
    
    const buttons = document.querySelectorAll('.btn, .cta-button, .footer-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${e.clientX - btn.offsetLeft}px`;
            ripple.style.top = `${e.clientY - btn.offsetTop}px`;
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            ripple.style.position = 'absolute';
            ripple.style.width = '100px';
            ripple.style.height = '100px';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255,255,255,0.4)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
});

const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
