import { createPost, createPostsHandlers } from './post.js';
import { openModal } from '../index.js'; // для открытия confirmModal

// ---------- Состояние модуля ----------
let currentUserFeed = null;        // null = общая лента, иначе ID пользователя
let feedContainer = null;
let feedLoader = null;
let allPostsBtn = null;
let userNameDisplay = null;
let confirmModal = null;

// ---------- Внутренние утилиты ----------
async function fetchPosts(url) {
    feedLoader.style.display = 'block';
    feedContainer.innerHTML = '';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        if (data.success) {
            renderPosts(data.data);
        } else {
            feedContainer.innerHTML = `<p class="error-message">${data.err_message || 'Не удалось загрузить посты'}</p>`;
        }
    } catch (err) {
        feedContainer.innerHTML = `<p class="error-message">${err.message}</p>`;
    } finally {
        feedLoader.style.display = 'none';
    }
}

function renderPosts(posts) {
    if (!posts || posts.length === 0) {
        feedContainer.innerHTML = '<p style="text-align:center;padding:2rem;">Пока нет постов</p>';
        return;
    }
    feedContainer.innerHTML = posts.map(post => createPost(post)).join('');
    createPostsHandlers();
}

// ---------- Публичные функции ленты ----------

/**
 * Загружает общую ленту (все посты).
 * Сбрасывает состояние currentUserFeed в null и показывает кнопку «Все посты»/логин-нейм.
 */
function loadMainFeed() {
    currentUserFeed = null;
    allPostsBtn.style.display = 'none';    // обычно прячем кнопку "Все посты" на общей ленте
    if (userNameDisplay) userNameDisplay.style.display = 'inline'; // показываем имя пользователя
    fetchPosts('/api/feed');
}

/**
 * Загружает ленту конкретного пользователя.
 * @param {number} userId - ID пользователя
 */
function loadUserFeed(userId) {
    currentUserFeed = userId;
    allPostsBtn.style.display = 'inline';  // показываем кнопку возврата к общей ленте
    if (userNameDisplay) userNameDisplay.style.display = 'none';
    fetchPosts(`/api/feed?user_id=${userId}`);
}

/**
 * Перезагружает текущую ленту (общую или пользовательскую).
 * Экспортируется для вызова из других модулей (например, после загрузки поста).
 */
export function reloadFeed() {
    if (currentUserFeed === null) {
        loadMainFeed();
    } else {
        loadUserFeed(currentUserFeed);
    }
}

/**
 * Позволяет внешним модулям явно запросить загрузку ленты пользователя.
 * @param {number} userId
 */
export function loadUserFeedById(userId) {
    loadUserFeed(userId);
}

// ---------- Инициализация (привязка к DOM) ----------

/**
 * Инициализирует ленту: кеширует DOM-элементы, вешает обработчики.
 * Вызывается один раз после загрузки DOM.
 */
export function initFeed() {
    feedContainer = document.getElementById('feedContainer');
    feedLoader = document.getElementById('feedLoader');
    allPostsBtn = document.getElementById('allPostsBtn');
    userNameDisplay = document.getElementById('userNameDisplay');
    confirmModal = document.getElementById('confirmModal');
    const logo = document.querySelector('.logo');

    // Кнопка «Все посты»
    allPostsBtn.addEventListener('click', loadMainFeed);

    // Клик по логотипу
    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            loadMainFeed();
        });
    }

    // Клик по имени пользователя
    if (userNameDisplay) {
        userNameDisplay.addEventListener('click', () => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.id && user.is_confirmed) {
                loadUserFeed(user.id);
            } else if (confirmModal) {
                openModal(confirmModal);
            }
        });
    }

    // Первоначальная загрузка
    loadMainFeed();
}