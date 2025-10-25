// Price Tracker — надёжная реализация
class PriceTracker {
    constructor() {
        this.currentTab = 'skins';
        this.data = {
            skins: [],
            accessories: [],
            items: [],
            cars: [],
            houses: []
        };
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.renderTab('skins'); // Явная инициализация
    }

    bindEvents() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                if (this.currentTab !== tab) {
                    this.renderTab(tab);
                }
            });
        });

        // Форма добавления
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });

        // Проверка дубликатов в реальном времени
        document.getElementById('item-name').addEventListener('input', () => {
            this.updateDuplicateWarning();
        });

        // Поиск и сортировка
        document.getElementById('search-input').addEventListener('input', () => this.renderItems());
        document.getElementById('sort-select').addEventListener('change', () => this.renderItems());

        // Экспорт
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // Модальное окно
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveItemChanges());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.deleteItem());
        document.getElementById('add-price-btn').addEventListener('click', () => this.addNewPriceToEdit());

        // Управление полями "Вещи"
        document.getElementById('is-per-unit').addEventListener('change', () => this.togglePerUnitFields());
        ['total-cost', 'quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateCalculatedPrice());
        });

        // В модальном окне
        document.getElementById('edit-is-per-unit').addEventListener('change', () => this.toggleEditPerUnitFields());
        ['edit-total-cost', 'edit-quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateEditCalculatedPrice());
        });
        document.getElementById('edit-name').addEventListener('input', () => this.updateEditDuplicateWarning());
    }

    // === ОСНОВНОЙ МЕТОД: ПЕРЕКЛЮЧЕНИЕ ВКЛАДКИ ===
    renderTab(tab) {
        // 1. Обновляем активную кнопку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // 2. Сохраняем текущую вкладку
        this.currentTab = tab;

        // 3. Обновляем видимость полей формы
        this.updateFormVisibility();

        // 4. Сбрасываем форму и поиск
        this.resetForm();
        document.getElementById('search-input').value = '';

        // 5. Рендерим список товаров
        this.renderItems();
        this.updateEmptyState();
    }

    updateFormVisibility() {
        const isGovTab = this.currentTab === 'cars' || this.currentTab === 'houses';
        const isItemsTab = this.currentTab === 'items';

        // Используем безопасное обновление через classList
        const govContainer = document.getElementById('gov-cost-container');
        const perUnitContainer = document.getElementById('per-unit-container');

        govContainer.style.display = isGovTab ? 'block' : 'none';
        perUnitContainer.style.display = isItemsTab ? 'block' : 'none';

        // Сбрасываем состояние чекбокса
        if (!isItemsTab) {
            document.getElementById('is-per-unit').checked = false;
            document.getElementById('per-unit-fields').style.display = 'none';
        }
    }

    resetForm() {
        document.getElementById('item-form').reset();
        document.getElementById('gov-cost').value = '';
        document.getElementById('total-cost').value = '';
        document.getElementById('quantity').value = '';
        document.getElementById('calculated-price').textContent = '';
        this.updateDuplicateWarning();
    }

    // === РАБОТА С ДУБЛИКАТАМИ ===
    updateDuplicateWarning() {
        const name = document.getElementById('item-name').value.trim();
        const warning = document.getElementById('duplicate-warning');
        warning.style.display = name && this.isDuplicate(name) ? 'block' : 'none';
    }

    updateEditDuplicateWarning() {
        const name = document.getElementById('edit-name').value.trim();
        const currentId = document.getElementById('edit-modal').dataset.itemId;
        const warning = document.getElementById('edit-duplicate-warning');
        warning.style.display = name && this.isDuplicate(name, currentId) ? 'block' : 'none';
    }

    isDuplicate(name, excludeId = null) {
        const normalizedName = name.toLowerCase().trim();
        return this.data[this.currentTab].some(item => 
            item.id !== excludeId && 
            item.name.toLowerCase().trim() === normalizedName
        );
    }

    // === ДОБАВЛЕНИЕ ТОВАРА ===
    addItem() {
        const rawName = document.getElementById('item-name').value;
        const name = rawName.trim();

        if (!name) {
            alert('Название не может быть пустым');
            return;
        }

        if (this.isDuplicate(name)) {
            alert('Товар с таким названием уже существует!');
            return;
        }

        const item = {
            id: Date.now().toString(),
            name,
            prices: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Для автомобилей и домов
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const costInput = document.getElementById('gov-cost').value;
            const cost = parseFloat(costInput);
            if (!isNaN(cost) && cost >= 0) {
                item.cost = cost;
            }
        }

        // Для вещей
        if (this.currentTab === 'items' && document.getElementById('is-per-unit').checked) {
            const totalInput = document.getElementById('total-cost').value;
            const qtyInput = document.getElementById('quantity').value;
            const total = parseFloat(totalInput);
            const qty = parseFloat(qtyInput);

            if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                alert('Введите корректную общую стоимость и количество');
                return;
            }

            item.isPerUnit = true;
            item.totalCost = total;
            item.quantity = qty;
            item.prices.push(total / qty);
        }

        this.data[this.currentTab].push(item);
        this.saveToStorage();
        this.resetForm();
        this.renderItems();
        this.updateEmptyState();
    }

    // === РЕНДЕР ТОВАРОВ ===
    renderItems() {
        const container = document.getElementById('items-list');
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const sortOption = document.getElementById('sort-select').value;

        let items = this.data[this.currentTab].filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );

        items = this.sortItems(items, sortOption);
        container.innerHTML = '';

        if (items.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        document.getElementById('empty-state').style.display = 'none';

        items.forEach(item => {
            const element = this.createItemElement(item);
            container.appendChild(element);
        });
    }

    createItemElement(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.id;

        const isPerUnit = this.currentTab === 'items' && item.isPerUnit;
        const suffix = isPerUnit ? ' ₽/шт' : ' ₽';
        const avgPrice = this.calculateAveragePrice(item.prices);
        const formattedAvg = `${this.formatNumber(avgPrice)}${suffix}`;
        const formattedPrices = item.prices.map(p => `${this.formatNumber(p)}${suffix}`);

        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.cost !== undefined ? `<div class="gov-cost">Стоимость: ${this.formatNumber(item.cost)} ₽</div>` : ''}
                    ${isPerUnit ? `<div class="gov-cost">Цена за штуку: ${formattedAvg}</div>` : ''}
                </div>
                <button class="edit-btn" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Редактировать
                </button>
            </div>
            <div class="item-meta">
                <span>Добавлено: ${this.formatDate(item.createdAt)}</span>
                <span>Обновлено: ${this.formatDate(item.updatedAt)}</span>
            </div>
            <div class="item-prices">
                ${formattedPrices.length > 0 
                    ? formattedPrices.map((p, i) => `
                        <div class="price-tag">
                            <span class="price-value">${p}</span>
                            <button class="remove-price" data-id="${item.id}" data-index="${i}">×</button>
                        </div>
                    `).join('')
                    : '<p class="text-secondary">Нет цен</p>'
                }
            </div>
            <div class="item-stats">
                <div class="avg-price">Средняя цена: ${formattedAvg}</div>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => {
            this.openEditModal(item);
        });

        card.querySelectorAll('.remove-price').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removePrice(e.target.dataset.id, parseInt(e.target.dataset.index));
            });
        });

        return card;
    }

    // === МОДАЛЬНОЕ ОКНО ===
    openEditModal(item) {
        const modal = document.getElementById('edit-modal');
        modal.dataset.itemId = item.id;

        // Основное название
        document.getElementById('edit-name').value = item.name;
        this.updateEditDuplicateWarning();

        // Стоимость (авто/дома)
        const govContainer = document.getElementById('edit-gov-cost-container');
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            govContainer.style.display = 'block';
            document.getElementById('edit-gov-cost').value = item.cost || '';
        } else {
            govContainer.style.display = 'none';
        }

        // Поля для "Вещи"
        const perUnitContainer = document.getElementById('edit-per-unit-container');
        if (this.currentTab === 'items') {
            perUnitContainer.style.display = 'block';
            const isPerUnit = !!item.isPerUnit;
            document.getElementById('edit-is-per-unit').checked = isPerUnit;
            document.getElementById('edit-per-unit-fields').style.display = isPerUnit ? 'block' : 'none';

            if (isPerUnit) {
                document.getElementById('edit-total-cost').value = item.totalCost || '';
                document.getElementById('edit-quantity').value = item.quantity || '';
                this.updateEditCalculatedPrice();
            }
        } else {
            perUnitContainer.style.display = 'none';
        }

        // Цены
        const priceList = document.getElementById('edit-price-list');
        priceList.innerHTML = '';
        item.prices.forEach((price, index) => {
            this.addPriceToEdit(price, index);
        });

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    saveItemChanges() {
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        const newName = document.getElementById('edit-name').value.trim();

        if (!newName) {
            alert('Название не может быть пустым');
            return;
        }

        if (this.isDuplicate(newName, itemId)) {
            alert('Товар с таким названием уже существует!');
            return;
        }

        const item = this.data[this.currentTab].find(i => i.id === itemId);
        if (!item) return;

        item.name = newName;
        item.updatedAt = new Date().toISOString();

        // Обновляем стоимость
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const costInput = document.getElementById('edit-gov-cost').value;
            const cost = parseFloat(costInput);
            if (!isNaN(cost) && cost >= 0) {
                item.cost = cost;
            } else {
                delete item.cost;
            }
        }

        // Обновляем параметры "Вещи"
        if (this.currentTab === 'items') {
            const isPerUnit = document.getElementById('edit-is-per-unit').checked;
            if (isPerUnit) {
                const totalInput = document.getElementById('edit-total-cost').value;
                const qtyInput = document.getElementById('edit-quantity').value;
                const total = parseFloat(totalInput);
                const qty = parseFloat(qtyInput);

                if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                    alert('Введите корректные значения');
                    return;
                }

                item.isPerUnit = true;
                item.totalCost = total;
                item.quantity = qty;

                if (item.prices.length === 0) {
                    item.prices = [total / qty];
                }
            } else {
                item.isPerUnit = false;
                delete item.totalCost;
                delete item.quantity;
            }
        }

        // Обновляем цены
        const newPrices = [];
        document.querySelectorAll('.edit-price-input').forEach(input => {
            const price = parseFloat(input.value);
            if (!isNaN(price) && price >= 0) {
                newPrices.push(price);
            }
        });
        item.prices = newPrices;

        this.saveToStorage();
        this.renderItems();
        this.closeModal();
    }

    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
    togglePerUnitFields() {
        const show = document.getElementById('is-per-unit').checked;
        document.getElementById('per-unit-fields').style.display = show ? 'block' : 'none';
        if (show) this.updateCalculatedPrice();
    }

    toggleEditPerUnitFields() {
        const show = document.getElementById('edit-is-per-unit').checked;
        document.getElementById('edit-per-unit-fields').style.display = show ? 'block' : 'none';
        if (show) this.updateEditCalculatedPrice();
    }

    updateCalculatedPrice() {
        const total = parseFloat(document.getElementById('total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('quantity').value) || 1;
        document.getElementById('calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
    }

    updateEditCalculatedPrice() {
        const total = parseFloat(document.getElementById('edit-total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('edit-quantity').value) || 1;
        document.getElementById('edit-calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
    }

    addPriceToEdit(price, index) {
        const priceList = document.getElementById('edit-price-list');
        const div = document.createElement('div');
        div.className = 'edit-price-item';
        div.innerHTML = `
            <input type="number" class="edit-price-input" value="${price}" min="0">
            <button class="btn btn-danger remove-edit-price">&times;</button>
        `;
        priceList.appendChild(div);

        div.querySelector('.remove-edit-price').addEventListener('click', () => {
            div.remove();
        });
    }

    addNewPriceToEdit() {
        const input = document.getElementById('new-price');
        const price = parseFloat(input.value);
        if (isNaN(price) || price < 0) {
            alert('Введите корректную цену');
            return;
        }
        this.addPriceToEdit(price, -1);
        input.value = '';
    }

    removePrice(itemId, index) {
        const item = this.data[this.currentTab].find(i => i.id === itemId);
        if (item) {
            item.prices.splice(index, 1);
            item.updatedAt = new Date().toISOString();
            this.saveToStorage();
            this.renderItems();
        }
    }

    deleteItem() {
        if (!confirm('Удалить товар? Это действие нельзя отменить.')) return;
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        this.data[this.currentTab] = this.data[this.currentTab].filter(i => i.id !== itemId);
        this.saveToStorage();
        this.renderItems();
        this.updateEmptyState();
        this.closeModal();
    }

    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    sortItems(items, option) {
        return [...items].sort((a, b) => {
            switch (option) {
                case 'name': return a.name.localeCompare(b.name, 'ru');
                case 'date': return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'price': 
                    return this.calculateAveragePrice(b.prices) - this.calculateAveragePrice(a.prices);
                default: return 0;
            }
        });
    }

    calculateAveragePrice(prices) {
        if (prices.length === 0) return 0;
        return prices.reduce((sum, p) => sum + p, 0) / prices.length;
    }

    formatNumber(num) {
        if (num === 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + ' млн';
        if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.?0+$/, '') + ' тыс';
        return num.toString();
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '<',
            '>': '>',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    saveToStorage() {
        try {
            localStorage.setItem('priceTrackerData', JSON.stringify(this.data));
        } catch (e) {
            console.error('Не удалось сохранить данные:', e);
            alert('Ошибка сохранения данных. Проверьте localStorage.');
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('priceTrackerData');
            if (data) {
                const parsed = JSON.parse(data);
                this.data = {
                    skins: Array.isArray(parsed.skins) ? parsed.skins : [],
                    accessories: Array.isArra
