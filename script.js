// Price Tracker — финальная, стабильная реализация
const PriceTracker = {
    currentTab: 'skins',
    editingItemId: null, // Хранит ID редактируемого товара
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
        this.switchTab('skins'); // Инициализация с первой вкладки
    },

    bindEvents() {
        // Навигация
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Формы
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });
        document.getElementById('item-name').addEventListener('input', () => this.checkDuplicate());
        document.getElementById('edit-name').addEventListener('input', () => this.checkEditDuplicate());
        
        // Управление
        document.getElementById('search-input').addEventListener('input', () => this.render());
        document.getElementById('sort-select').addEventListener('change', () => this.render());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // Модальное окно: основные действия
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.deleteItem());

        // Модальное окно: логика добавления цен
        document.getElementById('calculate-per-unit-checkbox').addEventListener('change', this.togglePriceInputMode.bind(this));
        document.getElementById('add-price-btn').addEventListener('click', this.addStandardPrice.bind(this));
        document.getElementById('add-calculated-price-btn').addEventListener('click', this.addCalculatedPrice.bind(this));
        ['new-total-cost', 'new-quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', this.updateCalculatedPricePreview.bind(this));
        });
    },

    switchTab(tab) {
        if (!tab) return;
        this.currentTab = tab;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.getElementById('gov-cost-container').style.display = (tab === 'cars' || tab === 'houses') ? 'block' : 'none';
        
        this.resetForm();
        document.getElementById('search-input').value = '';
        this.render();
    },

    resetForm() {
        document.getElementById('item-form').reset();
        this.checkDuplicate();
    },
    
    // ИСПРАВЛЕНО: Возвращен стандартный синтаксис для корректной работы `this`
    checkDuplicate() {
        const name = document.getElementById('item-name').value;
        const warning = document.getElementById('duplicate-warning');
        warning.style.display = name && this.isDuplicate(name) ? 'block' : 'none';
    },

    // ИСПРАВЛЕНО: Возвращен стандартный синтаксис для корректной работы `this`
    checkEditDuplicate() {
        const name = document.getElementById('edit-name').value;
        const warning = document.getElementById('edit-duplicate-warning');
        warning.style.display = name && this.isDuplicate(name, this.editingItemId) ? 'block' : 'none';
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
            alert('Товар с таким названием уже существует.');
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
        
        const avgPrice = this.calculateAveragePrice(item.prices);
        const suffix = this.currentTab === 'items' ? ' ₽/шт' : ' ₽';

        const pricesHTML = item.prices.length > 0
            ? item.prices.map(p => {
                const priceValue = typeof p === 'object' ? p.perUnit : p;
                return `<div class="price-tag"><span class="price-value">${this.formatNumber(priceValue)}${suffix}</span></div>`;
            }).join('')
            : `<span style="color: var(--text-secondary); font-size: 0.9rem;">Нет цен</span>`;

        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.cost !== undefined ? `<div class="gov-cost">Стоимость: ${this.formatNumber(item.cost)} ₽</div>` : ''}
                </div>
                <button class="edit-btn">Редактировать</button>
            </div>
            <div class="item-meta">Добавлено: ${this.formatDate(item.createdAt)}</div>
            <div class="item-prices">${pricesHTML}</div>
            <div class="item-stats">
                <div class="avg-price">Средняя цена: ${this.formatNumber(avgPrice)}${suffix}</div>
            </div>`;

        card.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(item.id));
        return card;
    },

    openEditModal(itemId) {
        const item = this.data[this.currentTab].find(i => i.id === itemId);
        if (!item) return;

        this.editingItemId = itemId;
        const modal = document.getElementById('edit-modal');
        document.getElementById('edit-name').value = item.name;
        
        const isCarsOrHouses = this.currentTab === 'cars' || this.currentTab === 'houses';
        const isItems = this.currentTab === 'items';

        document.getElementById('edit-gov-cost-container').style.display = isCarsOrHouses ? 'block' : 'none';
        if (isCarsOrHouses) {
            document.getElementById('edit-gov-cost').value = item.cost || '';
        }
        
        document.getElementById('price-calc-toggle-container').style.display = isItems ? 'block' : 'none';
        
        document.getElementById('calculate-per-unit-checkbox').checked = false;
        this.togglePriceInputMode();
        this.renderModalPriceList();
        this.checkEditDuplicate();

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    renderModalPriceList() {
        const listEl = document.getElementById('edit-price-list');
        listEl.innerHTML = '';
        const item = this.data[this.currentTab].find(i => i.id === this.editingItemId);
        if (!item) return;

        item.prices.forEach((price, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'edit-price-item';
            
            let detailsHTML;
            if (typeof price === 'object' && price !== null) {
                detailsHTML = `
                    <div class="edit-price-details">
                        <span class="main-price">${this.formatNumber(price.perUnit)} ₽/шт</span>
                        <div class="sub-details">Общая: ${this.formatNumber(price.totalCost)} ₽, Кол-во: ${this.formatNumber(price.quantity)} шт.</div>
                    </div>`;
            } else {
                const suffix = this.currentTab === 'items' ? ' ₽/шт' : ' ₽';
                detailsHTML = `<div class="edit-price-details"><span class="main-price">${this.formatNumber(price)}${suffix}</span></div>`;
            }

            itemEl.innerHTML = `${detailsHTML}<button class="remove-edit-price">&times;</button>`;
            itemEl.querySelector('.remove-edit-price').addEventListener('click', () => {
                item.prices.splice(index, 1);
                this.renderModalPriceList();
            });
            listEl.appendChild(itemEl);
        });
    },
    
    togglePriceInputMode() {
        const isChecked = document.getElementById('calculate-per-unit-checkbox').checked;
        document.getElementById('standard-price-container').style.display = isChecked ? 'none' : 'block';
        document.getElementById('per-unit-price-container').style.display = isChecked ? 'block' : 'none';
        this.updateCalculatedPricePreview();
    },

    updateCalculatedPricePreview() {
        const total = parseFloat(document.getElementById('new-total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('new-quantity').value) || 0;
        const previewEl = document.getElementById('new-calculated-price');
        
        if (total > 0 && qty > 0) {
            previewEl.textContent = `Цена за штуку: ${this.formatNumber(total / qty)} ₽`;
        } else {
            previewEl.textContent = '';
        }
    },
    
    addPriceToCurrentItem(priceData) {
        const item = this.data[this.currentTab].find(i => i.id === this.editingItemId);
        if (item) {
            item.prices.push(priceData);
            this.renderModalPriceList();
        }
    },

    addStandardPrice() {
        const input = document.getElementById('new-price');
        const price = parseFloat(input.value);
        if (isNaN(price) || price < 0) {
            alert('Введите корректную цену.');
            return;
        }
        this.addPriceToCurrentItem(price);
        input.value = '';
    },
    
    addCalculatedPrice() {
        const total = parseFloat(document.getElementById('new-total-cost').value);
        const qty = parseFloat(document.getElementById('new-quantity').value);

        if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
            alert('Заполните корректно общую стоимость и количество.');
            return;
        }
        
        this.addPriceToCurrentItem({
            totalCost: total,
            quantity: qty,
            perUnit: total / qty,
        });
        
        document.getElementById('new-total-cost').value = '';
        document.getElementById('new-quantity').value = '';
        this.updateCalculatedPricePreview();
    },

    saveChanges() {
        const item = this.data[this.currentTab].find(i => i.id === this.editingItemId);
        if (!item) return;
        
        const newName = document.getElementById('edit-name').value.trim();
        if (!newName || this.isDuplicate(newName, this.editingItemId)) {
            alert('Название не может быть пустым или дублироваться.');
            return;
        }
        
        item.name = newName;
        item.updatedAt = new Date().toISOString();

        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const cost = parseFloat(document.getElementById('edit-gov-cost').value);
            item.cost = (!isNaN(cost) && cost >= 0) ? cost : undefined;
        }

        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    deleteItem() {
        if (!this.editingItemId || !confirm('Удалить товар?')) return;
        this.data[this.currentTab] = this.data[this.currentTab].filter(i => i.id !== this.editingItemId);
        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.editingItemId = null;
    },

    calculateAveragePrice(prices) {
        if (!prices || prices.length === 0) return 0;
        const sum = prices.reduce((acc, p) => acc + (typeof p === 'object' && p !== null ? p.perUnit : p), 0);
        return sum / prices.length;
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
    
    formatDate: (iso) => new Date(iso).toLocaleDateString('ru-RU'),
    escapeHtml: (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]),
    formatNumber: (num) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num),

    saveToStorage() {
        try {
            localStorage.setItem('priceTrackerData', JSON.stringify(this.data));
        } catch (e) {
            console.error("Не удалось сохранить данные в localStorage:", e);
        }
    },
    loadFromStorage() {
        try {
            const storedData = localStorage.getItem('priceTrackerData');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                Object.keys(this.data).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        this.data[key] = parsed[key];
                    }
                });
            }
        } catch (e) { console.error("Ошибка загрузки данных из localStorage:", e); }
    },

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
};

// Запуск приложения
PriceTracker.init();
