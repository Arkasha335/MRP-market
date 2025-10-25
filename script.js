// Основной объект приложения
const PriceTracker = {
    // Текущий активный раздел
    currentTab: 'skins',
    
    // Данные по разделам
     {
        skins: [],
        accessories: [],
        items: [],
        cars: [],
        houses: []
    },
    
    // Инициализация приложения
    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.render();
        this.updateEmptyState();
    },
    
    // Привязка событий
    bindEvents() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Форма добавления товара
        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });
        
        // Поиск
        document.getElementById('search-input').addEventListener('input', () => {
            this.render();
        });
        
        // Сортировка
        document.getElementById('sort-select').addEventListener('change', () => {
            this.render();
        });
        
        // Экспорт данных
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        // Закрытие модального окна
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Сохранение изменений в модальном окне
        document.getElementById('save-changes-btn').addEventListener('click', () => {
            this.saveItemChanges();
        });
        
        // Удаление товара в модальном окне
        document.getElementById('delete-item-btn').addEventListener('click', () => {
            this.deleteItem();
        });
        
        // Добавление новой цены в модальном окне
        document.getElementById('add-price-btn').addEventListener('click', () => {
            this.addNewPriceToEdit();
        });
        
        // Обработка чекбокса "цена за штуку" в форме добавления
        document.getElementById('is-per-unit').addEventListener('change', () => {
            document.getElementById('per-unit-fields').style.display = 
                this.currentTab === 'items' && document.getElementById('is-per-unit').checked ? 'block' : 'none';
            this.updateCalculatedPrice();
        });
        
        // Обновление расчёта при изменении полей
        ['total-cost', 'quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateCalculatedPrice();
            });
        });
        
        // Обработка чекбокса в модальном окне
        document.getElementById('edit-is-per-unit').addEventListener('change', () => {
            document.getElementById('edit-per-unit-fields').style.display = 
                this.currentTab === 'items' && document.getElementById('edit-is-per-unit').checked ? 'block' : 'none';
            this.updateEditCalculatedPrice();
        });
        
        // Обновление расчёта в модальном окне
        ['edit-total-cost', 'edit-quantity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateEditCalculatedPrice();
            });
        });
    },
    
    // Обновление расчёта цены за штуку в форме добавления
    updateCalculatedPrice() {
        if (this.currentTab !== 'items' || !document.getElementById('is-per-unit').checked) return;
        
        const total = parseFloat(document.getElementById('total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('quantity').value) || 1;
        const pricePerUnit = total / qty;
        
        document.getElementById('calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(pricePerUnit)} ₽`;
    },
    
    // Обновление расчёта в модальном окне
    updateEditCalculatedPrice() {
        if (this.currentTab !== 'items' || !document.getElementById('edit-is-per-unit').checked) return;
        
        const total = parseFloat(document.getElementById('edit-total-cost').value) || 0;
        const qty = parseFloat(document.getElementById('edit-quantity').value) || 1;
        const pricePerUnit = total / qty;
        
        document.getElementById('edit-calculated-price').textContent = 
            `Цена за штуку: ${this.formatNumber(pricePerUnit)} ₽`;
    },
    
    // Переключение вкладки
    switchTab(tab) {
        if (this.currentTab === tab) return;
        
        this.currentTab = tab;
        
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Показываем/скрываем поля в зависимости от вкладки
        const govCostContainer = document.getElementById('gov-cost-container');
        const perUnitContainer = document.getElementById('per-unit-container');
        
        govCostContainer.style.display = (tab === 'cars' || tab === 'houses') ? 'block' : 'none';
        perUnitContainer.style.display = (tab === 'items') ? 'block' : 'none';
        
        // Сбрасываем форму
        this.resetForm();
        
        this.render();
        this.updateEmptyState();
    },
    
    // Сброс формы добавления
    resetForm() {
        document.getElementById('item-form').reset();
        document.getElementById('gov-cost').value = '';
        document.getElementById('is-per-unit').checked = false;
        document.getElementById('per-unit-fields').style.display = 'none';
        document.getElementById('total-cost').value = '';
        document.getElementById('quantity').value = '';
        document.getElementById('calculated-price').textContent = '';
    },
    
    // Проверка на дубликат (независимо от регистра)
    isDuplicate(name) {
        const normalizedName = name.trim().toLowerCase();
        return this.data[this.currentTab].some(item => 
            item.name.trim().toLowerCase() === normalizedName
        );
    },
    
    // Добавление нового товара
    addItem() {
        const name = document.getElementById('item-name').value.trim();
        if (!name) {
            alert('Название не может быть пустым');
            return;
        }
        
        // Проверка на дубликат
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
        
        // Для автомобилей и домов — гос. стоимость
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const govCost = parseFloat(document.getElementById('gov-cost').value);
            if (!isNaN(govCost) && govCost >= 0) {
                item.govCost = govCost;
            }
        }
        
        // Для вещей — цена за штуку
        if (this.currentTab === 'items' && document.getElementById('is-per-unit').checked) {
            const total = parseFloat(document.getElementById('total-cost').value);
            const qty = parseFloat(document.getElementById('quantity').value);
            
            if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                alert('Пожалуйста, введите корректную общую стоимость и количество');
                return;
            }
            
            const pricePerUnit = total / qty;
            item.prices.push(pricePerUnit);
            item.isPerUnit = true;
            item.totalCost = total;
            item.quantity = qty;
        }
        
        this.data[this.currentTab].push(item);
        this.saveToStorage();
        this.resetForm();
        this.render();
        this.updateEmptyState();
    },
    
    // Рендер списка товаров
    render() {
        const container = document.getElementById('items-list');
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const sortOption = document.getElementById('sort-select').value;
        
        // Фильтрация по поиску
        let items = this.data[this.currentTab].filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );
        
        // Сортировка
        items = this.sortItems(items, sortOption);
        
        // Очистка контейнера
        container.innerHTML = '';
        
        if (items.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }
        
        document.getElementById('empty-state').style.display = 'none';
        
        // Рендер каждого товара
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            container.appendChild(itemElement);
        });
    },
    
    // Создание элемента товара
    createItemElement(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.id;
        
        // Вычисляем среднюю цену
        const avgPrice = this.calculateAveragePrice(item.prices);
        const isPerUnit = this.currentTab === 'items' && item.isPerUnit;
        
        // Форматируем цены для отображения
        const formattedPrices = item.prices.map(price => 
            this.formatNumber(price) + (isPerUnit ? ' ₽/шт' : ' ₽')
        );
        const formattedAvgPrice = this.formatNumber(avgPrice) + (isPerUnit ? ' ₽/шт' : ' ₽');
        
        // Создаем HTML для карточки
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.govCost !== undefined ? `<div class="gov-cost">Гос. стоимость: ${this.formatNumber(item.govCost)} ₽</div>` : ''}
                    ${isPerUnit ? `<div class="gov-cost">Цена за штуку: ${formattedAvgPrice}</div>` : ''}
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
            <div class="item-prices" id="prices-${item.id}">
                ${formattedPrices.map((price, index) => `
                    <div class="price-tag">
                        <span class="price-value">${price}</span>
                        <button class="remove-price" data-id="${item.id}" data-index="${index}">×</button>
                    </div>
                `).join('')}
                ${formattedPrices.length === 0 ? '<p class="text-secondary">Нет цен</p>' : ''}
            </div>
            <div class="item-stats">
                <div class="avg-price">Средняя цена: ${formattedAvgPrice}</div>
            </div>
        `;
        
        // Привязываем обработчики событий
        card.querySelector('.edit-btn').addEventListener('click', () => {
            this.openEditModal(item);
        });
        
        card.querySelectorAll('.remove-price').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removePrice(e.target.dataset.id, parseInt(e.target.dataset.index));
            });
        });
        
        return card;
    },
    
    // Открытие модального окна редактирования
    openEditModal(item) {
        const modal = document.getElementById('edit-modal');
        const editName = document.getElementById('edit-name');
        const editGovCost = document.getElementById('edit-gov-cost');
        const govCostContainer = document.getElementById('edit-gov-cost-container');
        const perUnitContainer = document.getElementById('edit-per-unit-container');
        const priceList = document.getElementById('edit-price-list');
        
        // Устанавливаем данные в форму
        editName.value = item.name;
        
        // Показываем/скрываем поля гос. стоимости
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            govCostContainer.style.display = 'block';
            editGovCost.value = item.govCost || '';
        } else {
            govCostContainer.style.display = 'none';
        }
        
        // Показываем/скрываем поля для "Вещи"
        if (this.currentTab === 'items') {
            perUnitContainer.style.display = 'block';
            const isPerUnit = item.isPerUnit || false;
            document.getElementById('edit-is-per-unit').checked = isPerUnit;
            document.getElementById('edit-per-unit-fields').style.display = isPerUnit ? 'block' : 'none';
            
            if (isPerUnit) {
                document.getElementById('edit-total-cost').value = item.totalCost || '';
                document.getElementById('edit-quantity').value = item.quantity || '';
                this.updateEditCalculatedPrice();
            } else {
                document.getElementById('edit-total-cost').value = '';
                document.getElementById('edit-quantity').value = '';
                document.getElementById('edit-calculated-price').textContent = '';
            }
        } else {
            perUnitContainer.style.display = 'none';
        }
        
        // Очищаем список цен
        priceList.innerHTML = '';
        
        // Добавляем существующие цены
        item.prices.forEach((price, index) => {
            this.addPriceToEdit(price, index);
        });
        
        // Сохраняем ID товара для последующих операций
        modal.dataset.itemId = item.id;
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },
    
    // Закрытие модального окна
    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    },
    
    // Добавление цены в модальное окно
    addPriceToEdit(price, index) {
        const priceList = document.getElementById('edit-price-list');
        const priceItem = document.createElement('div');
        priceItem.className = 'edit-price-item';
        priceItem.innerHTML = `
            <input type="number" class="edit-price-input" value="${price}" min="0" data-index="${index}">
            <button class="btn btn-danger remove-edit-price" data-index="${index}">×</button>
        `;
        priceList.appendChild(priceItem);
        
        // Привязываем обработчик удаления
        priceItem.querySelector('.remove-edit-price').addEventListener('click', () => {
            priceItem.remove();
        });
    },
    
    // Добавление новой цены в модальное окно
    addNewPriceToEdit() {
        const newPriceInput = document.getElementById('new-price');
        const price = parseFloat(newPriceInput.value);
        
        if (isNaN(price) || price < 0) {
            alert('Пожалуйста, введите корректную цену');
            return;
        }
        
        const priceList = document.getElementById('edit-price-list');
        const index = priceList.children.length;
        this.addPriceToEdit(price, index);
        newPriceInput.value = '';
    },
    
    // Сохранение изменений товара
    saveItemChanges() {
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        const newName = document.getElementById('edit-name').value.trim();
        
        if (!newName) {
            alert('Название товара не может быть пустым');
            return;
        }
        
        // Проверка на дубликат (исключая текущий товар)
        const isDuplicate = this.data[this.currentTab].some(item => 
            item.id !== itemId && item.name.trim().toLowerCase() === newName.trim().toLowerCase()
        );
        
        if (isDuplicate) {
            alert('Товар с таким названием уже существует!');
            return;
        }
        
        // Находим товар
        const itemIndex = this.data[this.currentTab].findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;
        
        const item = this.data[this.currentTab][itemIndex];
        
        // Обновляем название
        item.name = newName;
        
        // Обновляем гос. стоимость для автомобилей и домов
        if (this.currentTab === 'cars' || this.currentTab === 'houses') {
            const govCost = parseFloat(document.getElementById('edit-gov-cost').value);
            if (!isNaN(govCost) && govCost >= 0) {
                item.govCost = govCost;
            } else {
                delete item.govCost;
            }
        }
        
        // Обновляем параметры для "Вещи"
        if (this.currentTab === 'items') {
            const isPerUnit = document.getElementById('edit-is-per-unit').checked;
            if (isPerUnit) {
                const total = parseFloat(document.getElementById('edit-total-cost').value);
                const qty = parseFloat(document.getElementById('edit-quantity').value);
                
                if (isNaN(total) || total < 0 || isNaN(qty) || qty <= 0) {
                    alert('Пожалуйста, введите корректную общую стоимость и количество');
                    return;
                }
                
                const pricePerUnit = total / qty;
                item.isPerUnit = true;
                item.totalCost = total;
                item.quantity = qty;
                
                // Если нет других цен, добавляем рассчитанную
                if (item.prices.length === 0) {
                    item.prices = [pricePerUnit];
                }
            } else {
                item.isPerUnit = false;
                delete item.totalCost;
                delete item.quantity;
            }
        }
        
        // Обновляем цены
        const priceInputs = document.querySelectorAll('.edit-price-input');
        const newPrices = [];
        
        priceInputs.forEach(input => {
            const price = parseFloat(input.value);
            if (!isNaN(price) && price >= 0) {
                newPrices.push(price);
            }
        });
        
        item.prices = newPrices;
        item.updatedAt = new Date().toISOString();
        
        this.saveToStorage();
        this.render();
        this.closeModal();
    },
    
    // Удаление товара
    deleteItem() {
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
        
        const itemId = document.getElementById('edit-modal').dataset.itemId;
        this.data[this.currentTab] = this.data[this.currentTab].filter(item => item.id !== itemId);
        this.saveToStorage();
        this.render();
        this.updateEmptyState();
        this.closeModal();
    },
    
    // Удаление цены у товара
    removePrice(itemId, priceIndex) {
        const item = this.data[this.currentTab].find(item => item.id === itemId);
        if (!item) return;
        
        item.prices.splice(priceIndex, 1);
        item.updatedAt = new Date().toISOString();
        this.saveToStorage();
        this.render();
    },
    
    // Сортировка товаров
    sortItems(items, option) {
        return [...items].sort((a, b) => {
            switch (option) {
                case 'name':
  
