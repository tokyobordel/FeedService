import { createPost, createPostsHandlers } from "./post";

/**
 * Инициализирует основную ленту постов.
 *
 * Настраивает загрузку и отображение постов с сервера, переключение между
 * общей лентой и лентой конкретного пользователя. Управляет DOM-элементами
 * (`#feedContainer`, `#feedLoader`, `#allPostsBtn`, `.logo`, `#userNameDisplay`)
 * и создаёт глобальные функции `window.loadUserFeed` и `window.reloadFeed`.
 *
 * **Принцип работы:**
 * 1. По умолчанию загружается общая лента (`/api/feed`).
 * 2. При клике на имя автора поста вызывается `window.loadUserFeed(userId)`,
 *    которая загружает ленту конкретного пользователя (`/api/feed?user_id=...`).
 * 3. Кнопка «Все посты» и логотип возвращают к общей ленте.
 * 4. Клик по `#userNameDisplay` загружает ленту текущего залогиненного пользователя.
 * 5. Функция `window.reloadFeed` перезагружает текущую активную ленту.
 *
 *
 * @function initFeed
 * @global
 * @requires module:post~createPost - генерирует HTML карточки поста.
 * @requires module:post~createPostsHandlers - добавляет обработчики после рендеринга.
 * @requires HTML-элементы с id: `feedContainer`, `feedLoader`, `allPostsBtn`,
 *           `userNameDisplay`, а также элемент с классом `logo`.
 * @returns {void}
 *
 * @example
 * document.addEventListener('DOMContentLoaded', initFeed);
 */
export function initFeed() {
    // Контейнер для постов
    const feedContainer = document.getElementById('feedContainer');
    const feedLoader = document.getElementById('feedLoader');
    const allPostsBtn = document.getElementById('allPostsBtn');
    const logo = document.querySelector('.logo');

    // Текущий режим: null = общая лента, иначе ID пользователя
    let currentUserFeed = null;

    /**
     * Внутренняя функция загрузки постов с указанного URL.
     * @param {string} url - эндпоинт API
     * @returns {Promise<void>}
     */
    async function fetchPosts(url) {
        console.log(url)
        feedLoader.style.display = 'block';
        feedContainer.innerHTML = '';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Ошибка загрузки');
            const data = await response.json();
            if (data.success) {
                renderPosts(data.data);
            } else {
                feedContainer.innerHTML = `<p class="error-message">` +
                `{data.err_message || 'Не удалось загрузить посты'}</p>`;
            }
        } catch (err) {
            feedContainer.innerHTML = `<p class="error-message">${err.message}</p>`;
        } finally {
            feedLoader.style.display = 'none';
        }
    }

    /**
     * Внутренняя функция рендеринга массива постов.
     * @param {Array} posts - массив объектов постов
     */
    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            feedContainer.innerHTML = '<p style="text-align:center;padding:2rem;">'
            + 'Пока нет постов</p>';
            return;
        }

        feedContainer.innerHTML = posts.map(post => createPost(post)).join('');

        createPostsHandlers()
    }

    /** Загружает общую ленту, скрывая кнопку «Все посты» и показывая имя пользователя */
    function loadMainFeed() {
        currentUserFeed = null;
        allPostsBtn.style.display = 'none';
        userNameDisplay.style.display = 'inline-block'
        fetchPosts('/api/feed');
    }

    /**
     * Глобальная функция загрузки ленты конкретного пользователя.
     *
     * @global
     * @function loadUserFeed
     * @memberof window
     * @param {number} userId - ID пользователя для фильтрации постов.
     * @returns {void}
     */
    window.loadUserFeed = (userId) => {
        currentUserFeed = userId;
        allPostsBtn.style.display = 'inline';
        userNameDisplay.style.display = 'none'
        fetchPosts(`/api/feed?user_id=${userId}`);
    }

    // Обработчики
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        loadMainFeed();
    });

    allPostsBtn.addEventListener('click', () => {
        loadMainFeed();
    });

    // Клик по нику в хедере
    const userNameDisplay = document.getElementById('userNameDisplay');
    const confirmModal = document.getElementById('confirmModal');
    if (userNameDisplay) {
        userNameDisplay.addEventListener('click', () => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.id && user.is_confirmed) {
                loadUserFeed(user.id);
            } else {
                openModal(confirmModal)
            }
        });
    }

    // Инициализация: загружаем главную ленту
    loadMainFeed();

    /**
     * Глобальная функция перезагрузки текущей ленты.
     *
     * Если была открыта общая лента – перезагружает её,
     * иначе повторно загружает ленту ранее выбранного пользователя.
     *
     * @global
     * @function reloadFeed
     * @memberof window
     * @returns {void}
     */
    window.reloadFeed = function() {
        if (currentUserFeed === null) {
            loadMainFeed();
        } else {
            loadUserFeed(currentUserFeed);
        }
    };
};