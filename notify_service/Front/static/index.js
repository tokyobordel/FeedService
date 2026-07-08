import './styles/main.css';
import './styles/layout.css';
import './styles/components.css';

/**
 * Флаг состояния сохранения настроек
 * @type {boolean}
 */
let isSaving = false;

/**
 * Массив пользовательских строк настроек
 * @type {Array}
 */
let customRows = [];

/**
 * ID редактируемой строки
 * @type {number|null}
 */
let editingRowId = null;

/**
 * Массив предопределенных типов уведомлений
 * @type {string[]}
 */
const predefinedTypes = ["user_register", "user_login", "admin_newImg", "user_imgVerdict"];

/**
 * Карты соответствия для id чекбоксов предопределённых типов
 */
const emailIdMap = {
    'user_register': 'email_reg',
    'user_login': 'email_login',
    'user_imgVerdict': 'email_user_imgVerdict',
    'admin_newImg': 'email_admin_newImg'
};
const tgIdMap = {
    'user_register': 'tg_reg',
    'user_login': 'tg_login',
    'user_imgVerdict': 'tg_user_imgVerdict',
    'admin_newImg': 'tg_admin_newImg'
};

// Хранилище для удаленных дефолтных параметров (чтобы они не появлялись после перезагрузки)
let disabledPredefinedTypes = new Set(JSON.parse(localStorage.getItem('disabledPredefinedTypes') || '[]'));

/**
 * Инициализация системы уведомлений
 * @function initNotifications
 * @returns {void}
 */
(function initNotifications() {    
    const HEIGHT = 80;             
    const GAP = 20;                
    const LIFETIME = 3000;         
    const CONTAINER_WIDTH = '18%';
    const LEFT_OFFSET = '2%';
    const BOTTOM_OFFSET = 50;       

    const template = document.getElementById('notification');
    if (template) {
        template.style.display = 'none';
    }

    const notifications = []; 

    /**
     * Рендеринг уведомлений
     * @returns {void}
     */
    function render() {
        notifications.forEach((item, index) => {
            const bottomPos = BOTTOM_OFFSET + index * (HEIGHT + GAP);
            item.element.style.bottom = bottomPos + 'px';
            item.element.style.opacity = '1';
        });
    }

    /**
     * Удаление старых уведомлений
     * @returns {void}
     */
    function removeOldest() {
        if (notifications.length === 0) return;

        const oldest = notifications.pop();
        const el = oldest.element;

        el.style.transition = 'bottom 0.5s ease, opacity 0.5s ease';
        el.style.bottom = (window.innerHeight + HEIGHT) + 'px';
        el.style.opacity = '0';

        const onFinish = () => {
            el.remove();
            el.removeEventListener('transitionend', onFinish);
        };
        el.addEventListener('transitionend', onFinish);

        render(); 
    }

    /**
     * Отображение уведомления
     * @param {string} type - Тип уведомления (success/error)
     * @param {string} title - Заголовок уведомления
     * @param {string} description - Описание уведомления
     * @returns {void}
     */
    window.showNotification = function(type, title, description) {
        if (!template) return;

        const clone = template.cloneNode(true);
        clone.id = '';
        clone.style.display = 'block';
        clone.style.position = 'fixed';
        clone.style.left = LEFT_OFFSET;
        clone.style.width = 'auto';
        clone.style.maxWidth = '500px';
        clone.style.minWidth = '200px';
        clone.style.padding = '12px 20px';
        clone.style.borderRadius = '5px';
        clone.style.overflow = 'hidden';
        clone.style.zIndex = '2';
        clone.style.pointerEvents = 'none';

        clone.style.backgroundColor = type === 'success'
            ? 'rgba(0, 255, 0, 0.75)'
            : 'rgba(255, 0, 0, 0.75)';

        const titleSpan = clone.querySelector('.errorText');
        const descSpan = clone.querySelector('.errDesc');
        if (titleSpan) titleSpan.textContent = title;
        if (descSpan) descSpan.textContent = description;

        clone.style.transition = 'none';
        clone.style.bottom = -(HEIGHT + 100) + 'px';
        clone.style.opacity = '0';

        notifications.unshift({ element: clone });

        document.body.appendChild(clone);

        clone.offsetHeight;

        clone.style.transition = 'bottom 0.5s ease, opacity 0.5s ease';
        render();

        setTimeout(() => {
            removeOldest();
        }, LIFETIME);
    };
})();

/**
 * Инициализация мультиселектов для уже существующих строк (при пустой БД)
 */
function initExistingMultiselects() {
    const containers = document.querySelectorAll('.webhook-multiselect-container');
    multiselectInstances = [];
    containers.forEach(container => {
        const notifyType = container.dataset.notifyType;
        const instance = createMultiselect(container, notifyType);
        multiselectInstances.push({ notifyType, instance });
    });
}

/**
 * Сбор URL из существующих мультиселектов (при пустой БД)
 */
function updateWebhookUrlsFromExistingRows() {
    const containers = document.querySelectorAll('.webhook-multiselect-container');
    const urls = new Set();
    containers.forEach(container => {
        const selects = container.querySelectorAll('.option-item input[type="checkbox"]');
        selects.forEach(cb => {
            if (cb.checked) urls.add(cb.value);
        });
    });
    webhookUrls = Array.from(urls);
}

/**
 * Получение настроек уведомлений с сервера
 * @async
 * @function GetSettings
 * @returns {Promise<void>}
 */
async function GetSettings() {
    console.log("GetSettings called");
    try {
        const response = await fetchWithAuth("/api/get_notify_settings");
        const result = await response.json();
        console.log('Result:', result);

        const tbody = getTableBody();
        if (!tbody) return;

        // Если данных нет или массив пустой — ничего не перестраиваем
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            console.log("No data or empty data, keeping hardcoded rows");
            initExistingMultiselects();
            updateWebhookUrlsFromExistingRows();
            renderWebhookTable();
            renderCustomRows();
            return;
        }

        // Если данные есть — перестраиваем таблицу
        const data = result.data;

        // Очищаем tbody и customRows
        tbody.innerHTML = '';
        customRows = [];
        multiselectInstances = [];

        // Сначала обрабатываем предопределённые типы
        data.forEach(item => {
            if (predefinedTypes.includes(item.notify_type)) {
                if (disabledPredefinedTypes.has(item.notify_type)) {
                    return;
                }

                // Если в БД нет описания, берем дефолтное и сохраняем в переменную для UI
                if (!item.notify_description && defaultNotifyNames[item.notify_type]) {
                    item.notify_description = defaultNotifyNames[item.notify_type];
                }
                
                // Сохраняем описание, чтобы его можно было редактировать
                if (item.notify_description) {
                    predefinedDescriptions[item.notify_type] = item.notify_description;
                }

                const row = createPredefinedRow(item);
                tbody.appendChild(row);

                const container = row.querySelector('.webhook-multiselect-container');
                if (container) {
                    const nt = container.dataset.notifyType;
                    webhookSelections[nt] = item.webhook_urls || [];
                    const instance = createMultiselect(container, nt);
                    multiselectInstances.push({ notifyType: nt, instance });
                }
            } else {
                customRows.push({
                    id: Date.now() + Math.random(),
                    notify_type: item.notify_type,
                    description: item.notify_description || item.notify_type,
                    want_email: item.want_email,
                    want_telegram: item.want_telegram,
                    webhook_urls: item.webhook_urls || []
                });
            }
        });

        // Рендерим кастомные строки (они добавятся в конец таблицы)
        renderCustomRows();

        // Собираем все уникальные URL для списка вебхуков
        const allUrls = [];
        data.forEach(item => {
            (item.webhook_urls || []).forEach(url => {
                if (url && !allUrls.includes(url)) allUrls.push(url);
            });
        });
        webhookUrls = allUrls;

        // Обновляем все мультиселекты (включая кастомные)
        updateAllMultiselects();

        // Рендерим таблицу URL-ов
        renderWebhookTable();

    } catch (error) {
        console.error('Error:', error);
        renderWebhookTable();
        renderCustomRows();
    }
}

/**
 * Сохранение настроек уведомлений на сервере
 * @async
 * @function CompleteSetup
 * @returns {Promise<void>}
 */
async function CompleteSetup() {
    console.log('CompleteSetup called', new Date().toISOString());
    if (isSaving) return;
    isSaving = true;

    if (!isLogged) {
        console.log("Необходимо войти в аккаунт!");
        showNotification('error', 'Ошибка', 'Необходимо войти в аккаунт!');
        isSaving = false;
        return;
    }

    let payload = {
        "data": []
    };

    const activeTypes = predefinedTypes.filter(type => !disabledPredefinedTypes.has(type));

    activeTypes.forEach(type => {
        // Используем статические id из карт
        const emailId = emailIdMap[type];
        const tgId = tgIdMap[type];
        const customDescription = predefinedDescriptions[type];

        payload.data.push({
            "notify_type": type,
            "want_email": document.getElementById(emailId) ? document.getElementById(emailId).checked : false,
            "want_telegram": document.getElementById(tgId) ? document.getElementById(tgId).checked : false,
            "webhook_urls": webhookSelections[type] || [],
            ...(customDescription ? { "notify_description": customDescription } : {}),
        });
    });

    customRows.forEach(row => {
        if (row.notify_type && row.description) {
            payload.data.push({
                "notify_type": row.notify_type,
                "notify_description": row.description,
                "want_email": row.want_email,
                "want_telegram": row.want_telegram,
                "webhook_urls": webhookSelections[row.notify_type] || []
            });
        }
    });

    console.log("Final payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetchWithAuth("/api/notify_types", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            showNotification('error', 'Ошибка', 'При обращении к БД произошла ошибка');
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        showNotification('success', 'Успех', 'Настройки сохранены');
    } catch (error) {
        console.error('Error:', error);
        showNotification('error', 'Ошибка', 'Не удалось сохранить настройки');
    } finally {
        isSaving = false;
    }
}

const defaultNotifyNames = {
    'user_register': 'Регистрация аккаунта',
    'user_login': 'Вход в аккаунт',
    'user_imgVerdict': 'Решение по проверке фото',
    'admin_newImg': '[admin] Новое фото для модерации'
};

/**
 * Очистка устаревших выборов вебхуков
 * @function cleanupSelections
 * @returns {void}
 */
function cleanupSelections() {
    const currentUrls = new Set(webhookUrls);
    Object.keys(webhookSelections).forEach(notifyType => {
        webhookSelections[notifyType] = webhookSelections[notifyType].filter(url => currentUrls.has(url));
    });
}

/**
 * Возвращает элемент <tbody> таблицы .table_main.
 * Если его нет, создаёт и добавляет.
 * @returns {HTMLElement|null}
 */
function getTableBody() {
    // Сначала пробуем найти tbody по ID
    const tbody = document.getElementById('table_main_body');
    if (tbody) return tbody;

    // Если нет (на всякий случай), используем старый поиск
    const table = document.querySelector('.table_main');
    if (!table) return null;
    let tbodyEl = table.querySelector('tbody');
    if (!tbodyEl) {
        tbodyEl = document.createElement('tbody');
        tbodyEl.id = 'table_main_body'; // Добавляем ID, если создаем сами
        table.appendChild(tbodyEl);
    }
    return tbodyEl;
}

/**
 * Создание мультиселекта для выбора вебхуков
 * @function createMultiselect
 * @param {HTMLElement} container - Контейнер для мультиселекта
 * @param {string} notifyType - Тип уведомления
 * @returns {Object} Объект с методами мультиселекта
 */
function createMultiselect(container, notifyType) {
    if (!webhookSelections[notifyType]) {
        webhookSelections[notifyType] = [];
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const display = document.createElement('div');
    display.className = 'select-display';
    const placeholder = document.createElement('span');
    placeholder.className = 'select-placeholder';
    placeholder.textContent = 'Выберите URL';
    const arrow = document.createElement('span');
    arrow.className = 'select-arrow';
    arrow.textContent = '▾';
    display.appendChild(placeholder);
    display.appendChild(arrow);

    const optionsPanel = document.createElement('div');
    optionsPanel.className = 'select-options';

    /**
     * Рендеринг опций мультиселекта
     * @returns {void}
     */
    function renderOptions() {
        optionsPanel.innerHTML = '';
        if (webhookUrls.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'option-item';
            emptyMsg.textContent = 'Нет доступных URL';
            emptyMsg.style.color = '#999';
            optionsPanel.appendChild(emptyMsg);
            return;
        }
        webhookUrls.forEach(url => {
            const label = document.createElement('label');
            label.className = 'option-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = url;
            cb.checked = webhookSelections[notifyType].includes(url);
            label.appendChild(cb);
            label.appendChild(document.createTextNode(url));

            label.addEventListener('click', function(e) {
                e.preventDefault();
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    const selected = webhookSelections[notifyType];
                    const url = checkbox.value;
                    if (checkbox.checked) {
                        if (!selected.includes(url)) {
                            selected.push(url);
                        }
                    } else {
                        const idx = selected.indexOf(url);
                        if (idx !== -1) selected.splice(idx, 1);
                    }
                    updateDisplayText();
                }
            });

            optionsPanel.appendChild(label);

            cb.addEventListener('change', function(e) {
                e.stopPropagation();
                const selected = webhookSelections[notifyType];
                if (this.checked) {
                    if (!selected.includes(this.value)) {
                        selected.push(this.value);
                    }
                } else {
                    const idx = selected.indexOf(this.value);
                    if (idx !== -1) selected.splice(idx, 1);
                }
                updateDisplayText();
            });
        });
    }

    /**
     * Обновление отображаемого текста мультиселекта
     * @returns {void}
     */
    function updateDisplayText() {
        const selected = webhookSelections[notifyType] || [];
        if (selected.length === 0) {
            placeholder.textContent = 'Выберите URL';
            placeholder.style.color = '#999';
        } else {
            placeholder.textContent = selected.join(', ');
            placeholder.style.color = '#333';
        }
    }

    /**
     * Переключение видимости панели опций
     * @param {boolean} [forceState] - Принудительное состояние
     * @returns {void}
     */
    function togglePanel(forceState) {
        if (typeof forceState === 'boolean') {
            wrapper.classList.toggle('open', forceState);
        } else {
            wrapper.classList.toggle('open');
        }
    }

    display.addEventListener('click', function(e) {
        e.stopPropagation();
        togglePanel();
    });

    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            togglePanel(false);
        }
    });

    wrapper.appendChild(display);
    wrapper.appendChild(optionsPanel);
    container.innerHTML = '';
    container.appendChild(wrapper);

    renderOptions();
    updateDisplayText();

    return {
        renderOptions: renderOptions,
        updateDisplayText: updateDisplayText,
        getSelected: () => webhookSelections[notifyType] || [],
        setSelected: (urls) => {
            webhookSelections[notifyType] = urls || [];
            renderOptions();
            updateDisplayText();
        }
    };
}

/**
 * Массив экземпляров мультиселектов
 * @type {Array}
 */
let multiselectInstances = [];

/**
 * Инициализация всех мультиселектов на странице
 * @function initAllMultiselects
 * @returns {void}
 */
function initAllMultiselects() {
    const containers = document.querySelectorAll('.webhook-multiselect-container');
    multiselectInstances = [];
    containers.forEach(container => {
        const notifyType = container.dataset.notifyType;
        const instance = createMultiselect(container, notifyType);
        multiselectInstances.push({ notifyType, instance });
    });
}

/**
 * Обновление всех мультиселектов
 * @function updateAllMultiselects
 * @returns {void}
 */
function updateAllMultiselects() {
    cleanupSelections();
    multiselectInstances.forEach(({ instance }) => {
        instance.renderOptions();
        instance.updateDisplayText();
    });
}

/**
 * Закрытие модального окна авторизации
 * @function closeModal
 * @returns {void}
 */
function closeModal() {
    let modal_window = document.getElementById('modalWindow');
    let black_background = document.getElementById('blackBackground');
    modal_window.classList.remove('open');
    modal_window.classList.add('closed');
    black_background.classList.remove('open');
    black_background.classList.add('closed');
    modal_window.style.zIndex = '';
    modal_window.style.opacity = '';
    black_background.style.pointerEvents = '';
    black_background.style.background = '';
    black_background.style.backdropFilter = '';
}

/**
 * Открытие модального окна авторизации
 * @function openModal
 * @returns {void}
 */
function openModal() {
    let modal_window = document.getElementById('modalWindow');
    let black_background = document.getElementById('blackBackground');
    modal_window.classList.remove('closed');
    modal_window.classList.add('open');
    black_background.classList.remove('closed');
    black_background.classList.add('open');
    modal_window.style.zIndex = '';
    modal_window.style.opacity = '';
    black_background.style.pointerEvents = '';
    black_background.style.background = '';
    black_background.style.backdropFilter = '';
}

/**
 * Процедура авторизации пользователя
 * @async
 * @function loginProcedure
 * @returns {Promise<void>}
 */
async function loginProcedure() {
    let login_value = document.getElementById('login_field').value.trim();
    let password_value = document.getElementById('password_field').value.trim();

    if (!login_value || !password_value) {
        showNotification('error', 'Ошибка', 'Заполните все поля');
        return;
    }

    const payload = {
        "login": login_value,
        "password": password_value
    }

    try {
        const response = await fetch("/api/moderator_login", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log(result);
        if (result.success == true) {
            console.log("Вход успешен!");
            localStorage.setItem('token', result.token);
            isLogged = true;
            document.getElementById('not_Logged').style.display = "none";
            document.getElementById('isAuthorized').style.display = "block";
            closeModal();
            showNotification('success', 'Успех!', 'Успешный вход');
            GetSettings().then(() => hideDisabledRows());
        } else {
            console.log("Неправильные данные!");
            showNotification('error', 'Ошибка', result.Error_message || 'Неверный логин или пароль');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('error', 'Ошибка', 'Ошибка при попытке входа');
    }
}

/**
 * Процедура выхода пользователя
 * @async
 * @function logoutProcedure
 * @returns {Promise<void>}
 */
async function logoutProcedure() {
    localStorage.removeItem('token');
    isLogged = false;

    document.getElementById('login_field').value = "";
    document.getElementById('password_field').value = "";

    document.getElementById('not_Logged').style.display = "flex";
    document.getElementById('isAuthorized').style.display = "none";

    webhookUrls = [];
    webhookSelections = {};
    multiselectInstances = [];
    initAllMultiselects();
    renderWebhookTable();

    console.log("Выход успешен!");
    closeModal();
    showNotification('success', 'Успех', 'Выход из аккаунта успешен!');
}

/**
 * Выполнение fetch запроса с авторизацией
 * @function fetchWithAuth
 * @param {string} url - URL для запроса
 * @param {Object} [options={}] - Опции запроса
 * @returns {Promise<Response>} Promise с ответом
 */
function fetchWithAuth(url, options={}) {
    const token = localStorage.getItem('token');

    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    return fetch(url, options);
}

/**
 * Восстановление состояния авторизации
 * @function restoreAuthState
 * @returns {void}
 */
function restoreAuthState() {
    const token = localStorage.getItem('token');
    
    if (token) {
        isLogged = true;
        document.getElementById('not_Logged').style.display = "none";
        document.getElementById('isAuthorized').style.display = "block";
        console.log("Добро пожаловать, admin");
        initAllMultiselects();
        GetSettings().then(() => hideDisabledRows());
    } else {
        isLogged = false;
        document.getElementById('not_Logged').style.display = "flex";
        document.getElementById('isAuthorized').style.display = "none";
    }
}

// Массив URL вебхуков
let webhookUrls = [];
// Хранилище для выбранных вебхуков
let webhookSelections = {};
// Хранилище для кастомных названий захардкоженных параметров
let predefinedDescriptions = {}; 

/**
 * Индекс редактируемой строки вебхуков
 * @type {number|null}
 */
let editingIndex = null;

/**
 * Рендеринг таблицы вебхуков
 * @function renderWebhookTable
 * @returns {void}
 */
function renderWebhookTable() {
    const tbody = document.getElementById('webhookTableBody');
    if (!tbody) {
        console.warn('webhookTableBody не найден!');
        return;
    }

    const rows = [];
    webhookUrls.forEach((url, index) => {
        const isEditing = (editingIndex === index);
        rows.push({ url, index, isEditing, isNew: false });
    });

    if (editingIndex === null) {
        rows.push({ url: '', index: -1, isEditing: false, isNew: true });
    }

    tbody.innerHTML = '';
    rows.forEach((row) => {
        const tr = document.createElement('tr');

        const td = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'webhook-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'webhook-url-input';
        input.placeholder = 'Введите ссылку';
        input.value = row.url;
        input.disabled = !row.isEditing && !row.isNew;
        container.appendChild(input);

        if (row.isNew && !row.isEditing) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'webhook-action-btn save';
            saveBtn.textContent = '✓';
            saveBtn.style.display = 'none';
            saveBtn.title = 'Сохранить новый URL';
            saveBtn.style.marginLeft = '5px';

            input.addEventListener('input', function() {
                saveBtn.style.display = this.value.trim() ? 'inline-flex' : 'none';
            });

            saveBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const val = input.value.trim();
                if (!val) return;
                
                if (webhookUrls.includes(val)) {
                    showNotification('error', 'Ошибка', 'Такой URL уже существует');
                    return;
                }
                
                webhookUrls.push(val);
                editingIndex = null;
                renderWebhookTable();
                showNotification('success', 'Добавлено', 'Новый вебхук добавлен');
            });

            container.appendChild(saveBtn);
        } else if (!row.isNew) {
            if (row.isEditing) {
                const saveEditBtn = document.createElement('button');
                saveEditBtn.className = 'webhook-action-btn save';
                saveEditBtn.textContent = '✓';
                saveEditBtn.title = 'Сохранить изменения';
                saveEditBtn.style.marginLeft = '5px';
                saveEditBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const val = input.value.trim();
                    if (!val) {
                        showNotification('error', 'Ошибка', 'URL не может быть пустым');
                        return;
                    }
                    
                    if (val !== webhookUrls[row.index] && webhookUrls.includes(val)) {
                        showNotification('error', 'Ошибка', 'Такой URL уже существует');
                        return;
                    }
                    
                    webhookUrls[row.index] = val;
                    editingIndex = null;
                    renderWebhookTable();
                    showNotification('success', 'Изменено', 'URL обновлён');
                });
                container.appendChild(saveEditBtn);
            } else {
                const editBtn = document.createElement('button');
                editBtn.className = 'webhook-action-btn edit';
                editBtn.textContent = '✎';
                editBtn.title = 'Редактировать URL';
                editBtn.style.marginRight = '5px';
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    editingIndex = row.index;
                    renderWebhookTable();
                    setTimeout(() => {
                        const inp = document.querySelector(`#webhookTableBody tr[data-index="${row.index}"] .webhook-url-input`);
                        if (inp) inp.focus();
                    }, 50);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'webhook-action-btn delete';
                deleteBtn.textContent = '✕';
                deleteBtn.title = 'Удалить URL';
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const index = row.index;
                    if (confirm(`Удалить вебхук "${webhookUrls[index]}"?`)) {
                        webhookUrls.splice(index, 1);
                        if (editingIndex === index) editingIndex = null;
                        else if (editingIndex !== null && editingIndex > index) editingIndex--;
                        renderWebhookTable();
                        showNotification('success', 'Удалено', 'Вебхук удалён');
                    }
                });

                container.appendChild(editBtn);
                container.appendChild(deleteBtn);
            }
        }

        td.appendChild(container);
        tr.appendChild(td);
        tr.dataset.index = row.index;
        tbody.appendChild(tr);
    });
    updateAllMultiselects();
}

/**
 * Добавление пользовательской строки настроек
 * @function addCustomRow
 * @returns {void}
 */
function addCustomRow() {
    const newRow = {
        id: Date.now() + Math.random(),
        notify_type: '',
        description: '',
        want_email: false,
        want_telegram: false,
        webhook_urls: [],
        isNew: true
    };
    
    customRows.push(newRow);
    console.log('Добавлена строка, customRows теперь:', customRows);
    editingRowId = newRow.id;
    renderCustomRows();
    
    setTimeout(() => {
        const firstInput = document.querySelector(`tr[data-id="${newRow.id}"] input`);
        if (firstInput) firstInput.focus();
    }, 100);
}

/**
 * Удаление пользовательской строки настроек
 * @function deleteCustomRow
 * @param {number} id - ID строки для удаления
 * @returns {void}
 */
function deleteCustomRow(id) {
    customRows = customRows.filter(row => row.id !== id);
    renderCustomRows();
}

/**
 * Создание строки для предопределённого типа уведомления
 * @param {Object} item - данные из БД
 * @param {string} item.notify_type - ID типа
 * @param {string} item.notify_description - название
 * @param {boolean} item.want_email
 * @param {boolean} item.want_telegram
 * @param {string[]} item.webhook_urls
 * @returns {HTMLTableRowElement}
 */
function createPredefinedRow(item) {
    const tr = document.createElement('tr');
    tr.dataset.notifyType = item.notify_type;

    // Используем defaultNotifyNames, если нет описания в БД
    const desc = item.notify_description || defaultNotifyNames[item.notify_type] || item.notify_type;

    const nameTd = document.createElement('td');
    nameTd.style.cssText = 'border:1px solid transparent; padding:8px; text-align:left;';
    nameTd.innerHTML = `<p class="text">${desc}</p>`;

    // ID
    const idTd = document.createElement('td');
    idTd.style.cssText = 'border:1px solid transparent; padding:8px; text-align:left;';
    idTd.textContent = item.notify_type;

    // Telegram
    const tgTd = document.createElement('td');
    tgTd.style.cssText = 'border:1px solid transparent; padding:8px;';
    const tgChk = document.createElement('input');
    tgChk.type = 'checkbox';
    tgChk.id = tgIdMap[item.notify_type] || `tg_${item.notify_type}`;
    tgChk.checked = item.want_telegram;
    tgTd.appendChild(tgChk);

    // Email
    const emailTd = document.createElement('td');
    emailTd.style.cssText = 'border:1px solid transparent; padding:8px;';
    const emailChk = document.createElement('input');
    emailChk.type = 'checkbox';
    emailChk.id = emailIdMap[item.notify_type] || `email_${item.notify_type}`;
    emailChk.checked = item.want_email;
    emailTd.appendChild(emailChk);

    // Webhook
    const webhookTd = document.createElement('td');
    webhookTd.style.cssText = 'border:1px solid transparent; padding:8px;';
    const webhookContainer = document.createElement('div');
    webhookContainer.className = 'webhook-multiselect-container';
    webhookContainer.dataset.notifyType = item.notify_type;
    webhookTd.appendChild(webhookContainer);

    // Действия
    const actionsTd = document.createElement('td');
    actionsTd.style.cssText = 'border:1px solid transparent; padding:8px; text-align:center;';
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions-container';
    actionsDiv.innerHTML = `
        <button class="webhook-action-btn edit" data-notify-type="${item.notify_type}" title="Редактировать">✎</button>
        <button class="webhook-action-btn delete delete-row-btn" data-notify-type="${item.notify_type}" title="Удалить">×</button>
    `;
    actionsTd.appendChild(actionsDiv);

    tr.appendChild(nameTd);
    tr.appendChild(idTd);
    tr.appendChild(tgTd);
    tr.appendChild(emailTd);
    tr.appendChild(webhookTd);
    tr.appendChild(actionsTd);

    tr._nameCell = nameTd;
    tr._actionsContainer = actionsDiv;

    return tr;
}

/**
 * Редактирование предопределенного параметра
 * @function editPredefinedRow
 * @param {string} notifyType - Тип уведомления
 * @returns {void}
 */
function editPredefinedRow(notifyType) {
    const row = document.querySelector(`tr[data-notify-type="${notifyType}"]`);
    if (!row) return;

    const textCell = row._nameCell || row.querySelector('td:first-child');
    const textElem = textCell.querySelector('.text');
    const originalText = textElem.textContent;

    // Заменяем текст на поле ввода
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'custom-row-input';
    input.style.width = '100%';
    textCell.innerHTML = '';
    textCell.appendChild(input);
    input.focus();

    // Меняем кнопки действий на Сохранить и Отмена
    const actionsCell = row._actionsContainer || row.querySelector('.actions-container');
    actionsCell.innerHTML = '';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'webhook-action-btn save';
    saveBtn.textContent = '✓';
    saveBtn.title = 'Сохранить изменения';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'webhook-action-btn delete';
    cancelBtn.textContent = '✕';
    cancelBtn.title = 'Отмена';

    saveBtn.onclick = function() {
        const newText = input.value.trim();
        if (newText) {
            textCell.innerHTML = `<p class="text">${newText}</p>`;
            predefinedDescriptions[notifyType] = newText;
            restorePredefinedButtons(notifyType);
            showNotification('success', 'Сохранено', 'Название параметра обновлено');
        } else {
            showNotification('error', 'Ошибка', 'Название не может быть пустым');
        }
    };

    cancelBtn.onclick = function() {
        textCell.innerHTML = `<p class="text">${originalText}</p>`;
        restorePredefinedButtons(notifyType);
    };

    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

/**
 * Восстановление кнопок редактирования/удаления для дефолтной строки
 * @function restorePredefinedButtons
 * @param {string} notifyType - Тип уведомления
 * @returns {void}
 */
function restorePredefinedButtons(notifyType) {
    const row = document.querySelector(`tr[data-notify-type="${notifyType}"]`);
    if (!row) return;
    const actionsCell = row._actionsContainer || row.querySelector('.actions-container');
    actionsCell.innerHTML = `
        <button class="webhook-action-btn edit" data-notify-type="${notifyType}" title="Редактировать">✎</button>
        <button class="webhook-action-btn delete delete-row-btn" data-notify-type="${notifyType}" title="Удалить">×</button>
    `;
    // Заново привязываем обработчики
    const newEditBtn = actionsCell.querySelector('.edit');
    const newDeleteBtn = actionsCell.querySelector('.delete-row-btn');
    if (newEditBtn) newEditBtn.onclick = () => editPredefinedRow(notifyType);
    if (newDeleteBtn) newDeleteBtn.onclick = () => deletePredefinedRow(notifyType);
}

/**
 * Удаление предопределенного параметра
 * @function deletePredefinedRow
 * @param {string} notifyType - Тип уведомления
 * @returns {void}
 */
function deletePredefinedRow(notifyType) {
    if (confirm(`Вы уверены, что хотите удалить параметр ${notifyType}?`)) {
        // Добавляем в список удалённых
        disabledPredefinedTypes.add(notifyType);
        // Сохраняем в LocalStorage
        localStorage.setItem('disabledPredefinedTypes', JSON.stringify([...disabledPredefinedTypes]));
        // Удаляем строку из HTML
        const row = document.querySelector(`tr[data-notify-type="${notifyType}"]`);
        if (row) row.remove();
        // Очищаем выборы вебхуков для этого типа
        delete webhookSelections[notifyType];
        showNotification('success', 'Удалено', 'Параметр удалён');
    }
}

/**
 * Обновление значения в пользовательской строке
 * @function updateCustomRow
 * @param {number} id - ID строки
 * @param {string} field - Поле для обновления
 * @param {*} value - Новое значение
 * @returns {void}
 */
function updateCustomRow(id, field, value) {
    const row = customRows.find(r => r.id === id);
    if (row) {
        row[field] = value;
        if (field === 'notify_type' && !row.webhook_urls) {
            row.webhook_urls = [];
        }
    }
}

/**
 * Рендеринг пользовательских строк настроек
 * @function renderCustomRows
 * @returns {void}
 */
function renderCustomRows() {
    const tbody = getTableBody();
    if (!tbody) return;

    // Удаляем только ранее добавленные кастомные строки (они имеют класс .custom-row)
    const existingCustomRows = tbody.querySelectorAll('.custom-row');
    existingCustomRows.forEach(row => row.remove());

    customRows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'custom-row';
        tr.dataset.id = row.id;
        
        const nameCell = document.createElement('td');
        nameCell.style.border = '1px solid transparent';
        nameCell.style.padding = '8px';
        nameCell.style.textAlign = 'left';
        
        if (row.isNew || editingRowId === row.id) {
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'custom-row-input';
            nameInput.placeholder = 'Введите название';
            nameInput.value = row.description || '';
            nameInput.addEventListener('input', (e) => {
                updateCustomRow(row.id, 'description', e.target.value);
            });
            nameCell.appendChild(nameInput);
        } else {
            const nameText = document.createElement('span');
            nameText.textContent = row.description || '';
            nameCell.appendChild(nameText);
        }
        
        const idCell = document.createElement('td');
        idCell.style.border = '1px solid transparent';
        idCell.style.padding = '8px';
        idCell.style.textAlign = 'left';
        
        if (row.isNew || editingRowId === row.id) {
            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.className = 'custom-row-input';
            idInput.placeholder = 'Введите ID';
            idInput.value = row.notify_type || '';
            idInput.addEventListener('input', (e) => {
                updateCustomRow(row.id, 'notify_type', e.target.value);
            });
            idCell.appendChild(idInput);
        } else {
            const idText = document.createElement('span');
            idText.textContent = row.notify_type || '';
            idCell.appendChild(idText);
        }
        
        const tgCell = document.createElement('td');
        tgCell.style.border = '1px solid transparent';
        tgCell.style.padding = '8px';
        const tgCheckbox = document.createElement('input');
        tgCheckbox.type = 'checkbox';
        tgCheckbox.checked = row.want_telegram;
        tgCheckbox.addEventListener('change', (e) => {
            updateCustomRow(row.id, 'want_telegram', e.target.checked);
        });
        tgCell.appendChild(tgCheckbox);
        
        const emailCell = document.createElement('td');
        emailCell.style.border = '1px solid transparent';
        emailCell.style.padding = '8px';
        const emailCheckbox = document.createElement('input');
        emailCheckbox.type = 'checkbox';
        emailCheckbox.checked = row.want_email;
        emailCheckbox.addEventListener('change', (e) => {
            updateCustomRow(row.id, 'want_email', e.target.checked);
        });
        emailCell.appendChild(emailCheckbox);
        
        const webhookCell = document.createElement('td');
        webhookCell.style.border = '1px solid transparent';
        webhookCell.style.padding = '8px';
        const webhookContainer = document.createElement('div');
        webhookContainer.className = 'webhook-multiselect-container';
        webhookContainer.dataset.notifyType = row.notify_type || `custom_${row.id}`;
        webhookContainer.style.minWidth = '200px';
        webhookCell.appendChild(webhookContainer);
        
        const actionsCell = document.createElement('td');
        actionsCell.style.border = '1px solid transparent';
        actionsCell.style.padding = '8px';
        actionsCell.style.textAlign = 'center';
        
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'actions-container';
        
        if (row.isNew || editingRowId === row.id) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'webhook-action-btn save';
            saveBtn.textContent = '✓';
            saveBtn.title = row.isNew ? 'Добавить параметр' : 'Сохранить изменения';
            saveBtn.style.marginLeft = '5px';
            
            saveBtn.addEventListener('click', () => {
                console.log('Сохранение, customRows до:', customRows);
                if (row.isNew) {
                    if (!row.notify_type || !row.description) {
                        showNotification('error', 'Ошибка', 'Заполните все поля');
                        return;
                    }
                    if (predefinedTypes.includes(row.notify_type) || 
                        customRows.some(r => r.id !== row.id && r.notify_type === row.notify_type)) {
                        showNotification('error', 'Ошибка', 'Параметр с таким ID уже существует');
                        return;
                    }
                    delete row.isNew;
                    editingRowId = null;
                    showNotification('success', 'Добавлено', 'Параметр добавлен');
                } else {
                    editingRowId = null;
                    showNotification('success', 'Сохранено', 'Изменения сохранены');
                }
                renderCustomRows();
                console.log('customRows после сохранения:', customRows);
            });
            
            actionsContainer.appendChild(saveBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.className = 'webhook-action-btn edit';
            editBtn.textContent = '✎';
            editBtn.title = 'Редактировать';
            editBtn.style.marginRight = '5px';
            editBtn.addEventListener('click', () => {
                editingRowId = row.id;
                renderCustomRows();
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'webhook-action-btn delete';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Удалить';
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Вы уверены, что хотите удалить параметр "${row.description}"?`)) {
                    deleteCustomRow(row.id);
                    showNotification('success', 'Удалено', 'Параметр удален');
                }
            });
            
            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(deleteBtn);
        }
        
        actionsCell.appendChild(actionsContainer);
        
        tr.appendChild(nameCell);
        tr.appendChild(idCell);
        tr.appendChild(tgCell);
        tr.appendChild(emailCell);
        tr.appendChild(webhookCell);
        tr.appendChild(actionsCell);
        
        tbody.appendChild(tr);

        setTimeout(() => {
            if (!webhookSelections[webhookContainer.dataset.notifyType]) {
                webhookSelections[webhookContainer.dataset.notifyType] = row.webhook_urls || [];
            }
            const instance = createMultiselect(webhookContainer, webhookContainer.dataset.notifyType);
            multiselectInstances.push({ 
                notifyType: webhookContainer.dataset.notifyType, 
                instance 
            });
        }, 0);
    });
    
    setTimeout(() => {
        const editButtons = document.querySelectorAll('.webhook-action-btn.edit[data-notify-type]');
        editButtons.forEach(button => {
            if (!button.hasAttribute('data-handler-added')) {
                button.setAttribute('data-handler-added', 'true');
                button.addEventListener('click', function() {
                    const notifyType = this.dataset.notifyType;
                    editPredefinedRow(notifyType);
                });
            }
        });
        
        const deleteButtons = document.querySelectorAll('.delete-row-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const notifyType = this.dataset.notifyType;
                if (notifyType && confirm(`Вы уверены, что хотите удалить параметр ${notifyType}?`)) {
                    deletePredefinedRow(notifyType);
                }
            });
        });
    }, 100);
}

function hideDisabledRows() {
    disabledPredefinedTypes.forEach(type => {
        const row = document.querySelector(`tr[data-notify-type="${type}"]`);
        if (row) row.style.display = 'none';
    });
}

/**
 * Флаг авторизации пользователя
 * @type {boolean}
 */
let isLogged = false;

restoreAuthState();

if (!window._listenersAdded) {
    window._listenersAdded = true;

    document.addEventListener('DOMContentLoaded', function() {
        const addCustomRowBtn = document.getElementById('addCustomRowBtn');
        if (addCustomRowBtn) {
            addCustomRowBtn.addEventListener('click', addCustomRow);
        }
    });

    const openModalBtn = document.getElementById('openModalBtn');
    if (openModalBtn) openModalBtn.addEventListener('click', openModal);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutProcedure);

    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', loginProcedure);

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', CompleteSetup);
}