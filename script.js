// Price Tracker — стабильная, отказоустойчивая реализация
const PriceTracker = {
    currentTab: 'skins',
    modalState: { // Изолированное состояние для модального окна
        isOpen: false,
        itemId: null,
        itemCopy: null // Здесь будет храниться временная копия товара
    },
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
        this.switchTab('skins'); // Начинаем всегда со скинов
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', e => this.switchTab(e.target.dataset.tab)));
        document.getElementById('item-form').addEventListener('submit', e => { e.preventDefault(); this.addItem(); });
        document.getElementById('item-name').addEventListener('input', e => this.checkDuplicate(e.target.value));
        document.getElementById('edit-name').addEventListener('input', e => this.checkEditDuplicate(e.target.value));
        document.getElementById('search-input').addEventListener('input', () => this.render());
        document.getElementById('sort-select').addEventListener('change', () => this.render());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // Модальное окно
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('delete-item-btn').addEventListener('click', () => this.deleteItem());
        document.getElementById('calculate-per-unit-checkbox').addEventListener('change', () => this.togglePriceInputMode());
        document.getElementById('add-price-btn').addEventListener('click', () => this.addStandardPrice());
        document.getElementById('add-calculated-price-btn').addEventListener('click', () => this.addCalculatedPrice());
        ['new-total-cost', 'new-quantity'].forEach(id => document.getElementById(id).addEventListener('input', () => this.updateCalculatedPricePreview()));
    },

    switchTab(tab) {
        if (!tab) return;
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        document.getElementById('gov-cost-container').style.display = (tab === 'cars' || tab === 'houses') ? 'block' : 'none';
        this.resetForm();
        document.getElementById('search-input').value = '';
        this.render();
    },

    resetForm() {
        document.getElementById('item-form').reset();
        this.checkDuplicate('');
    },

    checkDuplicate(name) {
        document.getElementById('duplicate-warning').style.display = this.isDuplicate(name) ? 'block' : 'none';
    },

    checkEditDuplicate(name) {
        document.getElementById('edit-duplicate-warning').style.display = this.isDuplicate(name, this.modalState.itemId) ? 'block' : 'none';
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
        if (!name || this.isDuplicate(name)) {
            alert('Название товара не может быть пустым или дублироваться.');
            return;
        }
        const newItem = { id: Date.now().toString(), name, prices: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
        let itemsToRender = this.data[this.currentTab].filter(item => item.name.toLowerCase().includes(searchTerm));
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
            ? item.prices.map(p => `<div class="price-tag"><span class="price-value">${this.formatNumber(typeof p === 'object' ? p.perUnit : p)}${suffix}</span></div>`).join('')
            : `<span style="color: var(--text-secondary); font-size: 0.9rem;">Нет цен</span>`;
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.cost !== undefined ? `<div class="gov-cost">Стоимость: ${this.formatNumber(item.cost)} ₽</div>` : ''}
                </div>
                <button class="edit-btn" data-id="${item.id}">Редактировать</button>
            </div>
            <div class="item-meta">Добавлено: ${this.formatDate(item.createdAt)}</div>
            <div class="item-prices">${pricesHTML}</div>
            <div class="item-stats"><div class="avg-price">Средняя цена: ${this.formatNumber(avgPrice)}${suffix}</div></div>`;
        card.querySelector('.edit-btn').addEventListener('click', e => this.openEditModal(e.target.dataset.id));
        return card;
    },

    openEditModal(itemId) {
        const originalItem = this.data[this.currentTab].find(i => i.id === itemId);
        if (!originalItem) return;
        
        // Создаем ИЗОЛИРОВАННОЕ состояние для модального окна
        this.modalState = {
            isOpen: true,
            itemId: itemId,
            itemCopy: JSON.parse(JSON.stringify(originalItem)) // Глубокая копия
        };

        document.getElementById('edit-name').value = this.modalState.itemCopy.name;
        this.checkEditDuplicate(this.modalState.itemCopy.name);
        
        const isCarsOrHouses = this.currentTab === 'cars' || this.currentTab === 'houses';
        const isItems = this.currentTab === 'items';

        document.getElementById('edit-gov-cost-container').style.display = isCarsOrHouses ? 'block' : 'none';
        if (isCarsOrHouses) document.getElementById('edit-gov-cost').value = this.modalState.itemCopy.cost || '';
        
        document.getElementById('price-calc-toggle-container').style.display = isItems ? 'block' : 'none';
        document.getElementById('calculate-per-unit-checkbox').checked = false;
        
        this.togglePriceInputMode();
        this.renderModalPriceList();
        
        document.getElementById('edit-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    renderModalPriceList() {
        const listEl = document.getElementById('edit-price-list');
        listEl.innerHTML = '';
        this.modalState.itemCopy.prices.forEach((price, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'edit-price-item';
            const suffix = this.currentTab === 'items' ? ' ₽/шт' : ' ₽';
            let detailsHTML = typeof price === 'object'
                ? `<div class="edit-price-details"><span class="main-price">${this.formatNumber(price.perUnit)}${suffix}</span><div class="sub-details">Общая: ${this.formatNumber(price.totalCost)} ₽, Кол-во: ${this.formatNumber(price.quantity)} шт.</div></div>`
                : `<div class="edit-price-details"><span class="main-price">${this.formatNumber(price)}${suffix}</span></div>`;
            itemEl.innerHTML = `${detailsHTML}<button class="remove-edit-price">&times;</button>`;
            itemEl.querySelector('.remove-edit-price').addEventListener('click', () => {
                this.modalState.itemCopy.prices.splice(index, 1);
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
        const total = parseFloat(document.getElementById('new-total-cost').value) || 0, qty = parseFloat(document.getElementById('new-quantity').value) || 0;
        document.getElementById('new-calculated-price').textContent = (total > 0 && qty > 0) ? `Цена за штуку: ${this.formatNumber(total / qty)} ₽` : '';
    },

    addStandardPrice() {
        const input = document.getElementById('new-price');
        const price = parseFloat(input.value);
        if (isNaN(price) || price < 0) return alert('Введите корректную цену.');
        this.modalState.itemCopy.prices.push(price);
        this.renderModalPriceList();
        input.value = '';
    },
    
    addCalculatedPrice() {
        const total = parseFloat(document.getElementById('new-total-cost').value);
        const qty = parseFloat(document.getElementById('new-quantity').value);
        if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) return alert('Заполните корректно общую стоимость и количество.');
        this.modalState.itemCopy.prices.push({ totalCost: total, quantity: qty, perUnit: total / qty });
        this.renderModalPriceList();
        document.getElementById('new-total-cost').value = '';
        document.getElementById('new-quantity').value = '';
        this.updateCalculatedPricePreview();
    },

    saveChanges() {
        const newName = document.getElementById('edit-name').value.trim();
        if (!newName || this.isDuplicate(newName, this.modalState.itemId)) return alert('Название не может быть пустым или дублироваться.');
        
        // Обновляем КОПИЮ
        this.modalState.itemCopy.name = newName;
        this.modalState.itemCopy.updatedAt = new Date().toISOString();
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const cost = parseFloat(document.getElementById('edit-gov-cost').value);
            this.modalState.itemCopy.cost = (!isNaN(cost) && cost >= 0) ? cost : undefined;
        }

        // Находим индекс ОРИГИНАЛА и заменяем его обновленной КОПИЕЙ
        const itemIndex = this.data[this.currentTab].findIndex(i => i.id === this.modalState.itemId);
        if (itemIndex !== -1) this.data[this.currentTab][itemIndex] = this.modalState.itemCopy;

        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    deleteItem() {
        if (!confirm('Удалить товар?')) return;
        this.data[this.currentTab] = this.data[this.currentTab].filter(i => i.id !== this.modalState.itemId);
        this.saveToStorage();
        this.render();
        this.closeModal();
    },

    closeModal() {
        this.modalState = { isOpen: false, itemId: null, itemCopy: null }; // Сброс состояния
        document.getElementById('edit-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    },

    calculateAveragePrice: (prices) => (!prices || prices.length === 0) ? 0 : prices.reduce((acc, p) => acc + (typeof p === 'object' ? p.perUnit : p), 0) / prices.length,

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
    escapeHtml: (str) => str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]),
    formatNumber: (num) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num),

    saveToStorage() { localStorage.setItem('priceTrackerData', JSON.stringify(this.data)); },
    loadFromStorage() {
        try {
            const storedData = localStorage.getItem('priceTrackerData');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                Object.keys(this.data).forEach(key => { this.data[key] = Array.isArray(parsed[key]) ? parsed[key] : []; });
            }
        } catch (e) { console.error("Ошибка загрузки данных:", e); }
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
    }
};

PriceTracker.init();
