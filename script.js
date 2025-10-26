// Price Tracker — стабильная реализация
const PriceTracker = {
    currentTab: 'skins',
    data: {
        skins: [],
        accessories: [],
        items: [],
        cars: [],
        houses: []
    },

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.switchTab(this.currentTab); // Устанавливаем начальную вкладку
    },

    bindEvents() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Форма добавления
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });

        // Проверка дубликатов при вводе
        document.getElementById('item-name').addEventListener('input', () => this.checkDuplicate());
        document.getElementById('edit-name').addEventListener('input', () => this.checkEditDuplicate());

        // Поиск и сортировка
        document.getElementById('search-input').addEventListener('input', () => this.render());
        document.getElementById('sort-select').addEventListener('change', () => this.render());

        // Экспорт
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // Модальное окно
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.deleteItem());
        document.getElementById('add-price-btn').addEventListener('click', () => this.addNewPriceToModal());

        // Управление полями для "Вещей" в форме добавления
        const isPerUnitCheckbox = document.getElementById('is-per-unit');
        isPerUnitCheckbox.addEventListener('change', () => this.togglePerUnitFields(isPerUnitCheckbox, 'per-unit-fields'));
        ['total-cost', 'quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateCalculatedPrice('total-cost', 'quantity', 'calculated-price'));
        });

        // Управление полями для "Вещей" в модальном окне
        const editIsPerUnitCheckbox = document.getElementById('edit-is-per-unit');
        editIsPerUnitCheckbox.addEventListener('change', () => this.togglePerUnitFields(editIsPerUnitCheckbox, 'edit-per-unit-fields'));
        ['edit-total-cost', 'edit-quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateCalculatedPrice('edit-total-cost', 'edit-quantity', 'edit-calculated-price'));
        });
    },

    switchTab(tab) {
        if (!tab) return;
        this.currentTab = tab;

        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Обновляем видимость специальных полей формы
        const hasCost = tab === 'cars' || tab === 'houses';
        const isItems = tab === 'items';
        document.getElementById('gov-cost-container').style.display = hasCost ? 'block' : 'none';
        document.getElementById('per-unit-container').style.display = isItems ? 'block' : 'none';

        // Сбрасываем форму и поиск при смене вкладки
        this.resetForm();
        document.getElementById('search-input').value = '';
        this.render();
    },

    resetForm() {
        const form = document.getElementById('item-form');
        if (form) form.reset();
        document.getElementById('per-unit-fields').style.display = 'none';
        document.getElementById('calculated-price').textContent = '';
        this.checkDuplicate();
    },

    checkDuplicate() {
        const name = document.getElementById('item-name').value;
        const warning = document.getElementById('duplicate-warning');
        warning.style.display = name && this.isDuplicate(name) ? 'block' : 'none';
    },

    checkEditDuplicate() {
        const name = document.getElementById('edit-name').value;
        const currentId = document.getElementById('edit-modal').dataset.itemId;
        const warning = document.getElementById('edit-duplicate-warning');
        warning.style.display = name && this.isDuplicate(name, currentId) ? 'block' : 'none';
    },

    isDuplicate(name, excludeId = null) {
        const normalizedName = name.toLowerCase().trim();
        if (!normalizedName) return false;
        return this.data[this.currentTab].some(item =>
            item.name.toLowerCase().trim() === normalizedName && item.id !== excludeId
        );
    },

    addItem() {
        const nameInput = document.getElementById('item-name');
        const name = nameInput.value.trim();
        if (!name) {
            alert('Название товара не может быть пустым.');
            return;
        }
        if (this.isDuplicate(name)) {
            alert('Товар с таким названием уже существует в этом разделе!');
            return;
        }

        const newItem = {
            id: Date.now().toString(),
            name,
            prices: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const cost = parseFloat(document.getElementById('gov-cost').value);
            if (!isNaN(cost) && cost >= 0) newItem.cost = cost;
        }

        if (this.currentTab === 'items' && document.getElementById('is-per-unit').checked) {
            const total = parseFloat(document.getElementById('total-cost').value);
            const qty = parseFloat(document.getElementById('quantity').value);
            if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                alert('Для расчета цены за штуку необходимо корректно заполнить общую стоимость и количество.');
                return;
            }
            newItem.isPerUnit = true;
            newItem.totalCost = total;
            newItem.quantity = qty;
            newItem.prices.push(total / qty);
        }

        this.data[this.currentTab].push(newItem);
        this.saveToStorage();
        this.render();
        this.resetForm();
    },

    render() {
        const container = document.getElementById('items-list');
        const emptyState = document.getElementById('empty-state');
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const sortOption = document.getElementById('sort-select').value;

        let itemsToRender = this.data[this.currentTab].filter(item =>
            item.name.toLowerCase().includes(searchTerm)
        );

        itemsToRender = this.sortItems(itemsToRender, sortOption);
        container.innerHTML = '';

        if (itemsToRender.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            itemsToRender.forEach(item => container.appendChild(this.createItemCard(item)));
        }
    },

    createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.id;

        const avgPrice = this.calculateAveragePrice(item.prices);
        const isPerUnit = this.currentTab === 'items' && item.isPerUnit;
        const suffix = isPerUnit ? ' ₽/шт' : ' ₽';
        
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.cost !== undefined ? `<div class="gov-cost">Стоимость: ${this.formatNumber(item.cost)} ₽</div>` : ''}
                </div>
                <button class="edit-btn" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Редактировать
                </button>
            </div>
            <div class="item-meta">
                Добавлено: ${this.formatDate(item.createdAt)}
            </div>
            <div class="item-prices">
                ${item.prices.length > 0
                    ? item.prices.map((p, i) => `
                        <div class="price-tag">
                            <span class="price-value">${this.formatNumber(p)}${suffix}</span>
                        </div>`).join('')
                    : `<span style="color: var(--text-secondary); font-size: 0.9rem;">Нет цен для отображения</span>`
                }
            </div>
            <div class="item-stats">
                <div class="avg-price">Средняя цена: ${this.formatNumber(avgPrice)}${suffix}</div>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(item.id));
        return card;
    },

    openEditModal(itemId) {
        const item = this.data[this.currentTab].find(i => i.id === itemId);
        if (!item) return;

        const modal = document.getElementById('edit-modal');
        modal.dataset.itemId = item.id;
        document.getElementById('edit-name').value = item.name;

        // Видимость полей
        const hasCost = this.currentTab === 'cars' || this.currentTab === 'houses';
        const isItems = this.currentTab === 'items';
        document.getElementById('edit-gov-cost-container').style.display = hasCost ? 'block' : 'none';
        document.getElementById('edit-per-unit-container').style.display = isItems ? 'block' : 'none';

        if (hasCost) {
            document.getElementById('edit-gov-cost').value = item.cost || '';
        }

        if (isItems) {
            const checkbox = document.getElementById('edit-is-per-unit');
            checkbox.checked = !!item.isPerUnit;
            this.togglePerUnitFields(checkbox, 'edit-per-unit-fields');
            if (item.isPerUnit) {
                document.getElementById('edit-total-cost').value = item.totalCost || '';
                document.getElementById('edit-quantity').value = item.quantity || '';
                this.updateCalculatedPrice('edit-total-cost', 'edit-quantity', 'edit-calculated-price');
            }
        }

        const priceList = document.getElementById('edit-price-list');
        priceList.innerHTML = '';
        item.prices.forEach((price, index) => this.addPriceToModal(price, index));
        
        this.checkEditDuplicate();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },
    
    addPriceToModal(price, index) {
        const priceList = document.getElementById('edit-price-list');
        const div = document.createElement('div');
        div.className = 'edit-price-item';
        div.innerHTML = `
            <input type="number" class="edit-price-input" value="${price}" min="0" placeholder="Цена">
            <button class="remove-edit-price">&times;</button>
        `;
        div.querySelector('.remove-edit-price').addEventListener('click', () => div.remove());
        priceList.appendChild(div);
    },
    
    addNewPriceToModal() {
        const newPriceInput = document.getElementById('new-price');
        const price = parseFloat(newPriceInput.value);
        if (!isNaN(price) && price >= 0) {
            this.addPriceToModal(price, -1);
            newPriceInput.value = '';
        } else {
            alert('Введите корректное неотрицательное число.');
        }
    },

    saveChanges() {
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        const itemIndex = this.data[this.currentTab].findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        const newName = document.getElementById('edit-name').value.trim();
        if (!newName) {
            alert('Название товара не может быть пустым.');
            return;
        }
        if (this.isDuplicate(newName, itemId)) {
            alert('Товар с таким названием уже существует в этом разделе!');
            return;
        }
        
        const item = this.data[this.currentTab][itemIndex];
        item.name = newName;
        item.updatedAt = new Date().toISOString();

        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const cost = parseFloat(document.getElementById('edit-gov-cost').value);
            item.cost = (!isNaN(cost) && cost >= 0) ? cost : undefined;
        }

        if (this.currentTab === 'items') {
            item.isPerUnit = document.getElementById('edit-is-per-unit').checked;
            if (item.isPerUnit) {
                const total = parseFloat(document.getElementById('edit-total-cost').value);
                const qty = parseFloat(document.getElementById('edit-quantity').value);
                 if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                    alert('Для расчета цены за штуку необходимо корректно заполнить общую стоимость и количество.');
                    return;
                }
                item.totalCost = total;
                item.quantity = qty;
            } else {
                delete item.totalCost;
                delete item.quantity;
            }
        }
        
        const newPrices = [];
        document.querySelectorAll('.edit-price-input').forEach(input => {
            const price = parseFloat(input.value);
            if (!isNaN(price) && price >= 0) newPrices.push(price);
        });
        item.prices = newPrices;

        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    deleteItem() {
        if (!confirm('Вы уверены, что хотите удалить этот товар? Это действие необратимо.')) return;
        
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        this.data[this.currentTab] = this.data[this.currentTab].filter(i => i.id !== itemId);
        
        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    closeModal() {
        const modal = document.getElementById('edit-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        modal.dataset.itemId = '';
    },

    sortItems(items, option) {
        return [...items].sort((a, b) => {
            switch (option) {
                case 'name': return a.name.localeCompare(b.name, 'ru');
                case 'date': return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'price': return this.calculateAveragePrice(b.prices) - this.calculateAveragePrice(a.prices);
                default: return 0;
            }
        });
    },

    // Вспомогательные функции
    calculateAveragePrice: (prices) => prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    formatDate: (iso) => new Date(iso).toLocaleDateString('ru-RU'),
    escapeHtml: (str) => str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]),
    formatNumber(num) {
        return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
    },
    togglePerUnitFields: (checkbox, fieldsId) => {
        document.getElementById(fieldsId).style.display = checkbox.checked ? 'block' : 'none';
    },
    updateCalculatedPrice(totalId, qtyId, resultId) {
        const total = parseFloat(document.getElementById(totalId).value) || 0;
        const qty = parseFloat(document.getElementById(qtyId).value) || 1;
        const resultEl = document.getElementById(resultId);
        if (qty > 0) {
            resultEl.textContent = `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
        } else {
            resultEl.textContent = '';
        }
    },

    // Хранилище
    saveToStorage() {
        try {
            localStorage.setItem('priceTrackerData', JSON.stringify(this.data));
        } catch (e) {
            console.error("Ошибка сохранения данных:", e);
        }
    },
    loadFromStorage() {
        try {
            const storedData = localStorage.getItem('priceTrackerData');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                // Валидация, чтобы избежать ошибок с данными старого формата
                this.data.skins = Array.isArray(parsed.skins) ? parsed.skins : [];
                this.data.accessories = Array.isArray(parsed.accessories) ? parsed.accessories : [];
                this.data.items = Array.isArray(parsed.items) ? parsed.items : [];
                this.data.cars = Array.isArray(parsed.cars) ? parsed.cars : [];
                this.data.houses = Array.isArray(parsed.houses) ? parsed.houses : [];
            }
        } catch (e) {
            console.error("Ошибка загрузки данных:", e);
        }
    },

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// Запуск приложения
PriceTracker.init();
