// Supabase конфигурация
const SUPABASE_URL = 'https://fllzqyxakrjwqdudndsu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zLJTwgWmldicE9FydB0Xgg_2BmxmgbB';

// Инициализация Supabase клиента
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    let login, password;

    if (role === 'demo') {
        login = 'demo';
        password = 'demo';
    } else {
        login = loginInput.value.trim();
        password = passwordInput.value;
    }

    if (!login || !password) {
        authError.textContent = 'Введите логин и пароль';
        return false;
    }

    // Показываем состояние загрузки
    const originalBtnText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Проверка...';
    loginBtn.disabled = true;

    try {
        // Ищем пользователя в Supabase (используем маленькие буквы - etrnusers)
        const { data: users, error } = await supabaseClient
            .from('etrnusers')  // ← ВАЖНО: все маленькие буквы
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

        // Проверка пароля
        if (user.password !== password) {
            authError.textContent = 'Неверный логин или пароль';
            passwordInput.value = '';
            passwordInput.focus();
            return false;
        }

        // Проверка срока действия (обратите внимание: expires_at вместо expiresAt)
        if (isPasswordExpired(user.expires_at)) {
            authError.textContent = `Срок действия пароля истёк. Доступ был до ${user.expires_at}`;
            passwordInput.value = '';
            passwordInput.focus();
            return false;
        }

        // Авторизация успешна
        closeAuthModal();
        
        // Сохраняем данные пользователя в sessionStorage
        const userData = {
            id: user.id,
            login: user.name,
            role: user.role || 'full',
            displayName: user.display_name || user.name,
            expiresAt: user.expires_at
        };
        sessionStorage.setItem('etrn_user', JSON.stringify(userData));
        
        // Переход на страницу сервиса
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

// Функция открытия модального окна авторизации
function openAuthModal() {
    authModal.style.display = 'flex';
    loginInput.value = '';
    passwordInput.value = '';
    authError.textContent = '';
    setTimeout(() => loginInput.focus(), 100);
}

// Функция закрытия модального окна авторизации
function closeAuthModal() {
    authModal.style.display = 'none';
    authError.textContent = '';
}

// Функция открытия модального окна политики безопасности
function openPrivacyModal() {
    privacyModal.style.display = 'flex';
}

// Функция закрытия модального окна политики безопасности
function closePrivacyModalFunc() {
    privacyModal.style.display = 'none';
}

// Обработчик Enter в полях ввода
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        checkAuth();
    }
}

// Дублирование содержимого XML для бесконечной прокрутки
function setupInfiniteScroll() {
    const xmlContainer = document.getElementById('scrollingXml');
    if (!xmlContainer) return;
    
    const originalContent = xmlContainer.innerHTML;
    xmlContainer.innerHTML = originalContent + originalContent;
}

// Анимация появления карточек при скролле
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

// Плавная остановка анимации при наведении на XML
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

// Навешиваем обработчики
goToAppBtn.addEventListener('click', openAuthModal);
closeModalBtn.addEventListener('click', closeAuthModal);
cancelAuthBtn.addEventListener('click', closeAuthModal);
loginBtn.addEventListener('click', () => checkAuth());
if (demoBtn) demoBtn.addEventListener('click', () => checkAuth('demo'));
loginInput.addEventListener('keypress', handleKeyPress);
passwordInput.addEventListener('keypress', handleKeyPress);

// Обработчики для модального окна политики
if (privacyPolicyBtn) {
    privacyPolicyBtn.addEventListener('click', openPrivacyModal);
}
if (closePrivacyModal) {
    closePrivacyModal.addEventListener('click', closePrivacyModalFunc);
}
if (closePrivacyBtn) {
    closePrivacyBtn.addEventListener('click', closePrivacyModalFunc);
}

// Закрытие по клику вне модального окна
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        closeAuthModal();
    }
    if (e.target === privacyModal) {
        closePrivacyModalFunc();
    }
});

// Инициализация всех эффектов
document.addEventListener('DOMContentLoaded', () => {
    setupInfiniteScroll();
    setupScrollAnimation();
    setupXmlHover();
    
    const hero = document.querySelector('.hero');
    if (hero) hero.style.opacity = '1';
    
    // Добавляем эффект ripple для кнопок
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

// Добавляем стиль для ripple эффекта
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
