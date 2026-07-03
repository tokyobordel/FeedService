import './styles.css';  // ← добавляем эту строку
const sleep = ms => new Promise(r => setTimeout(r, ms));
let isSaving = false;

(function initNotifications() {    
    const HEIGHT = 65;             
    const GAP = 20;                
    const LIFETIME = 3000;         
    const CONTAINER_WIDTH = '22%';
    const LEFT_OFFSET = '2%';
    const BOTTOM_OFFSET = 90;       

    const template = document.getElementById('notification');
    if (template) {
        template.style.display = 'none';
    }

    const notifications = []; 

    function render() {
        notifications.forEach((item, index) => {
            const bottomPos = BOTTOM_OFFSET + index * (HEIGHT + GAP);
            item.element.style.bottom = bottomPos + 'px';
            item.element.style.opacity = '1';
        });
    }

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

    window.showNotification = function(type, title, description) {
        if (!template) return;

        const clone = template.cloneNode(true);
        clone.id = '';
        clone.style.display = 'block';
        clone.style.position = 'fixed';
        clone.style.left = LEFT_OFFSET;
        clone.style.width = CONTAINER_WIDTH;
        clone.style.height = HEIGHT + 'px';
        clone.style.margin = '0';
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

function getSelectedWebhookTypes() {
    const select = document.getElementById('webhook_select_1');
    return Array.from(select.selectedOptions).map(opt => opt.value);
}

// Функция для сохранения настроек
async function CompleteSetup() {
    console.log('CompleteSetup called', new Date().toISOString());
    if (isSaving) return;
        isSaving = true;

    if (!isLogged) {
        console.log("Необходимо войти в аккаунт!");
        showNotification('error', 'Ошибка', 'Необходимо войти в аккаунт!');
        isSaving = false; // сбрасываем блокировку перед выходом
        return;
    }

    let payload = {
        "data": [
            {
                "notify_type": "user_register",
                "want_email": document.getElementById('email_reg').checked,
                "want_telegram": document.getElementById('tg_reg').checked,
                "want_webhook": document.getElementById('webhook_reg').checked
            },
            {
                "notify_type": "user_login",
                "want_email": document.getElementById('email_login').checked,
                "want_telegram": document.getElementById('tg_login').checked,
                "want_webhook": document.getElementById('webhook_login').checked
            },
            {
                "notify_type": "admin_newImg",
                "want_email": document.getElementById('email_admin_newImg').checked,
                "want_telegram": document.getElementById('tg_admin_newImg').checked,
                "want_webhook": document.getElementById('webhook_admin_newImg').checked
            },
            {
                "notify_type": "user_imgVerdict",
                "want_email": document.getElementById('email_user_imgVerdict').checked,
                "want_telegram": document.getElementById('tg_user_imgVerdict').checked,
                "want_webhook": document.getElementById('webhook_user_imgVerdict').checked
            }
        ],
        "webhookData": {
            "url": document.getElementById('urlInput').value,
            "notificationTypes": getSelectedWebhookTypes()
        }
    };

    try {
        const response = await fetch("/api/notify_types", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            showNotification('error', 'Ошибка', 'При обращении к БД произошла ошибка')
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

// Функция для получения настроек из базы
async function GetSettings() {
    try {
        const response = await fetch("/api/get_notify_settings");
        const result = await response.json();
        const data = result["data"];
        data.forEach((item) => {
            const notify_type = item.notify_type;
            const want_email = item.want_email;
            const want_telegram = item.want_telegram;
            const want_webhook = item.want_webhook

            switch (notify_type) {
                case "user_register":
                    document.getElementById('email_reg').checked = want_email;
                    document.getElementById('tg_reg').checked = want_telegram;
                    document.getElementById('webhook_reg').checked = want_webhook;
                    break;
                case "user_login":
                    document.getElementById('email_login').checked = want_email;
                    document.getElementById('tg_login').checked = want_telegram;
                    document.getElementById('webhook_login').checked = want_webhook;
                    break;
                case "admin_newImg":
                    document.getElementById('email_admin_newImg').checked = want_email;
                    document.getElementById('tg_admin_newImg').checked = want_telegram;
                    document.getElementById('webhook_admin_newImg').checked = want_webhook;
                    break;
                case "user_imgVerdict":
                    document.getElementById('email_user_imgVerdict').checked = want_email;
                    document.getElementById('tg_user_imgVerdict').checked = want_telegram;
                    document.getElementById('webhook_user_imgVerdict').checked = want_webhook;
                    break;
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

// Функция для анимации закрытия всплывающего окна входа в аккаунт
function closeModal() {
    let modal_window = document.getElementById('modalWindow');
    let black_background = document.getElementById('blackBackground');
    modal_window.style.opacity = "0%";
    modal_window.style.transform = "translate(-50%, -50%)";
    black_background.style.pointerEvents = "none";
    black_background.style.background = "rgba(0, 0, 0, 0)";
    black_background.style.backdropFilter = "none";
    modal_window.style.zIndex = "-1";
}

// Функция для анимации открытия всплывающего окна входа в аккаунт
function openModal() {
    let modal_window = document.getElementById('modalWindow');
    let black_background = document.getElementById('blackBackground');
    modal_window.style.zIndex = "2";
    modal_window.style.opacity = "100%";
    modal_window.style.transform = "translate(-50%, -75%)";
    black_background.style.pointerEvents = "auto";
    black_background.style.background = "rgba(0, 0, 0, 0.5)";
    black_background.style.backdropFilter = "blur(7px)";
}

// Функция для процедуры входа в аккаунт
async function loginProcedure() {
    let login_value = document.getElementById('login_field').value;
    let password_value = document.getElementById('password_field').value;

    if (login_value == "admin" && password_value == "12345") {
        console.log("Вход успешен!");
        isLogged = true;
        document.getElementById('autorize').style.display = "none";
        document.getElementById('isAuthorized').style.display = "block";
        closeModal();
        showNotification('success', 'Успех!', 'Успешный вход');
    } else {
        console.log("Неправильные данные!");
        showNotification('error', 'Ошибка', 'Неверно введен логин или пароль');
    }
}

// Функция для процедуры выхода из аккаунта
async function logoutProcedure() {
    document.getElementById('login_field').value = "";
    document.getElementById('password_field').value = "";

    document.getElementById('autorize').style.display = "block";
    document.getElementById('isAuthorized').style.display = "none";

    console.log("Выход успешен!");
    closeModal();
    isLogged = false;
    showNotification('success', 'Успех', 'Выход из аккаунта успешен!');
}

GetSettings();
let isLogged = false;

(function initCustomSelect() {
    const container = document.getElementById('webhookSelectContainer');
    if (!container) return;

    const display = container.querySelector('.select-display');
    const optionsPanel = container.querySelector('.select-options');
    const placeholder = display.querySelector('.select-placeholder');
    const checkboxes = optionsPanel.querySelectorAll('input[type="checkbox"]');
    const hiddenSelect = document.getElementById('webhook_select_1');
    const optionItems = optionsPanel.querySelectorAll('.option-item');

    function updateDisplay() {
        const checked = [];
        const labels = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const label = cb.closest('.option-item');
                if (label) {
                    labels.push(label.textContent.trim());
                }
                checked.push(cb.value);
            }
        });

        if (checked.length === 0) {
            placeholder.textContent = 'Ничего не выбрано';
            placeholder.style.color = '#999';
        } else {
            placeholder.textContent = labels.join(', ');
            placeholder.style.color = '#333';
        }

        // Синхронизация со скрытым select
        if (hiddenSelect) {
            Array.from(hiddenSelect.options).forEach(opt => {
                opt.selected = checked.includes(opt.value);
            });
            hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // Открыть/закрыть список
    display.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = container.classList.toggle('open');
        optionsPanel.style.display = isOpen ? 'block' : 'none';
    });

    // Обработка клика по строке (включая текст и чекбокс)
    optionItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Предотвращаем стандартное переключение чекбокса через label
            e.preventDefault();

            const checkbox = this.querySelector('input[type="checkbox"]');
            if (checkbox) {
                // Переключаем состояние чекбокса
                checkbox.checked = !checkbox.checked;
                // Обновляем отображение
                updateDisplay();
            }
        });
    });

    // Закрывать список при клике вне компонента
    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            container.classList.remove('open');
            optionsPanel.style.display = 'none';
        }
    });

    // Инициализация: ничего не выбрано
    checkboxes.forEach(cb => cb.checked = false);
    updateDisplay();
})();

// Добавляем обработчики событий (гарантируем однократное выполнение)
if (!window._listenersAdded) {
    window._listenersAdded = true;

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