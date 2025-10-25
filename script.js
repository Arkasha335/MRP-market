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
        this.switchTab('skins');
    },

    bindEvents() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Форма добавления
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });

        // Проверка дубликатов
        document.getElementById('item-name').addEventListener('input', () => {
            this.checkDuplicate();
        });

        // Поиск и сортировка
        document.getElementById('search-input').addEventListener('input', () => this.render());
        document.getElementById('sort-select').addEventListener('change', () => this.render());

        // Экспорт
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // Модальное окно
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.deleteItem());
        document.getElementById('add-price-btn').addEventListener('click', () => this.addNewPrice());

        // Управление полями "Вещи"
        document.getElementById('is-per-unit').addEventListener('change', () => {
            document.getElementById('per-unit-fields').style.display = 
                this.currentTab === 'items' && document.getElementById('is-per-unit').checked ? 'block' : 'none';
            this.updateCalculatedPrice();
        });
        ['total-cost', 'quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateCalculatedPrice());
        });

        // В модальном окне
        document.getElementById('edit-is-per-unit').addEventListener('change', () => {
            document.getElementById('edit-per-unit-fields').style.display = 
                this.currentTab === 'items' && document.getElementById('edit-is-per-unit').checked ? 'block' : 'none';
            this.updateEditCalculatedPrice();
        });
        ['edit-total-cost', 'edit-quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateEditCalculatedPrice());
        });
        document.getElementById('edit-name').addEventListener('input', () => this.checkEditDuplicate());
    },

    switchTab(tab) {
        if (this.currentTab === tab) return;
        
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.currentTab = tab;

        // Обновляем видимость полей
        document.getElementById('gov-cost-container').style.display = 
            (tab === 'cars' || tab === 'houses') ? 'block' : 'none';
        document.getElementById('per-unit-container').style.display = 
            (tab === 'items') ? 'block' : 'none';

        // Сбрасываем форму
        this.resetForm();
        document.getElementById('search-input').value = '';
        this.render();
        this.updateEmptyState();
    },

    resetForm() {
        document.getElementById('item-form').reset();
        document.getElementById('gov-cost').value = '';
        document.getElementById('is-per-unit').checked = false;
        document.getElementById('per-unit-fields').style.display = 'none';
        document.getElementById('total-cost').value = '';
        document.getElementById('quantity').value = '';
        document.getElementById('calculated-price').textContent = '';
        this.checkDuplicate();
    },

    checkDuplicate() {
        const name = document.getElementById('item-name').value.trim();
        const warning = document.getElementById('duplicate-warning');
        warning.style.display = name && this.isDuplicate(name) ? 'block' : 'none';
    },

    checkEditDuplicate() {
        const name = document.getElementById('edit-name').value.trim();
        const currentId = document.getElementById('edit-modal').dataset.itemId;
        const warning = document.getElementById('edit-duplicate-warning');
        warning.style.display = name && this.isDuplicate(name, currentId) ? 'block' : 'none';
    },

    isDuplicate(name, excludeId = null) {
        const normalizedName = name.toLowerCase().trim();
        return this.data[this.currentTab].some(item => 
            item.id !== excludeId && 
            item.name.toLowerCase().trim() === normalizedName
        );
    },

    addItem() {
        const name = document.getElementById('item-name').value.trim();
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
            const cost = parseFloat(document.getElementById('gov-cost').value);
            if (!isNaN(cost) && cost >= 0) {
                item.cost = cost;
            }
        }

        // Для вещей
        if (this.currentTab === 'items' && document.getElementById('is-per-unit').checked) {
            const total = parseFloat(document.getElementById('total-cost').value);
            const qty = parseFloat(document.getElementById('quantity').value);
            if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                alert('Введите корректные значения');
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
        this.render();
        this.updateEmptyState();
    },

    render() {
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

            container.appendChild(card);
        });
    },

    openEditModal(item) {
        const modal = document.getElementById('edit-modal');
        modal.dataset.itemId = item.id;
        document.getElementById('edit-name').value = item.name;
        this.checkEditDuplicate();

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
    },

    saveChanges() {
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
            const cost = parseFloat(document.getElementById('edit-gov-cost').value);
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
                const total = parseFloat(document.getElementById('edit-total-cost').value);
                const qty = parseFloat(document.getElementById('edit-quantity').value);
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
        this.render();
        this.closeModal();
    },

    // Вспомогательные методы
    updateCalculatedPrice() {
        if (!document.getElementById('per-unit-fields').style.display.includes('block')) return;
        const total = parseFloat(document.getElementById('total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('quantity').value) || 1;
        document.getElementById('calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
    },

    updateEditCalculatedPrice() {
        if (!document.getElementById('edit-per-unit-fields').style.display.includes('block')) return;
        const total = parseFloat(document.getElementById('edit-total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('edit-quantity').value) || 1;
        document.getElementById('edit-calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
    },

    addPriceToEdit(price, index) {
        const priceList = document.getElementById('edit-price-list');
        const div = document.createElement('div');
        div.className = 'edit-price-item';
        div.innerHTML = `
            <input type="number" class="edit-price-input" value="${price}" min="0">
            <button class="btn btn-danger remove-edit-price">&times;</button>
        `;
        priceList.appendChild(div);
        div.querySelector('.remove-edit-price').addEventListener('click', () => div.remove());
    },

    addNewPrice() {
        const input = document.getElementById('new-price');
        const price = parseFloat(input.value);
        if (isNaN(price) || price < 0) {
            alert('Введите корректную цену');
            return;
        }
        this.addPriceToEdit(price, -1);
        input.value = '';
    },

    removePrice(itemId, index) {
        const item = this.data[this.currentTab].find(i => i.id === itemId);
        if (item) {
            item.prices.splice(index, 1);
            item.updatedAt = new Date().toISOString();
            this.saveToStorage();
            this.render();
        }
    },

    deleteItem() {
        if (!confirm('Удалить товар?')) return;
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        this.data[this.currentTab] = this.data[this.currentTab].filter(i => i.id !== itemId);
        this.saveToStorage();
        this.render();
        this.updateEmptyState();
        this.closeModal();
    },

    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    },

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
    },

    calculateAveragePrice(prices) {
        if (prices.length === 0) return 0;
        return prices.reduce((sum, p) => sum + p, 0) / prices.length;
    },

    formatNumber(num) {
        if (num === 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + ' млн';
        if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.?0+$/, '') + ' тыс';
        return num.toString();
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    escapeHtml(text) {
        const map = {'&': '&amp;', '<': '<', '>': '>', '"': '&quot;', "'": '&#039;'};
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    saveToStorage() {
        localStorage.setItem('priceTrackerData', JSON.stringify(this.data));
    },

    loadFromStorage() {
        const data = localStorage.getItem('priceTrackerData');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.data = {
                    skins: Array.isArray(parsed.skins) ? parsed.skins : [],
                    accessories: Array.isArray(parsed.accessories) ? parsed.accessories : [],
                    items: Array.isArray(parsed.items) ? parsed.items : [],
                    cars: Array.isArray(parsed.cars) ? parsed.cars : [],
                    houses: Array.isArray(parsed.houses) ? parsed.houses : []
                };
            } catch (e) {
                console.error('Ошибка загрузки данных', e);
            }
        }
    },

    updateEmptyState() {
        document.getElementById('empty-state').style.display = 
            this.data[this.currentTab].length === 0 ? 'block' : 'none';
    },

    exportData() {
        let content = 'Price Tracker — Экспорт данных\n';
        content += '================================\n\n';

        const sections = [
            {key: 'skins', title: 'Скины'},
            {key: 'accessories', title: 'Аксессуары'},
            {key: 'items', title: 'Вещи'},
            {key: 'cars', title: 'Автомобили'},
            {key: 'houses', title: 'Дома'}
        ];

        sections.forEach(section => {
            content += `${section.title}\n${'='.repeat(section.title.length)}\n\n`;
            if (this.data[section.key].length === 0) {
                content += 'Нет товаров\n\n';
                return;
            }

            this.data[section.key].forEach(item => {
                content += `Название: ${item.name}\n`;
                content += `Добавлен: ${t
