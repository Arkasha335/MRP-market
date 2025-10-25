// Основной объект приложения
const PriceTracker = {
    // Текущий активный раздел
    currentTab: 'skins',
    
    // Данные по разделам
    data: {
        skins: [],
        accessories: [],
        cars: []
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
    },
    
    // Переключение вкладки
    switchTab(tab) {
        if (this.currentTab === tab) return;
        
        this.currentTab = tab;
        
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Показываем/скрываем поле гос. стоимости
        const govCostContainer = document.getElementById('gov-cost-container');
        govCostContainer.style.display = tab === 'cars' ? 'block' : 'none';
        
        // Очищаем форму
        document.getElementById('item-form').reset();
        document.getElementById('gov-cost').value = '';
        
        this.render();
        this.updateEmptyState();
    },
    
    // Добавление нового товара
    addItem() {
        const name = document.getElementById('item-name').value.trim();
        if (!name) return;
        
        const item = {
            id: Date.now().toString(),
            name,
            prices: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Для автомобилей добавляем гос. стоимость
        if (this.currentTab === 'cars') {
            const govCost = parseFloat(document.getElementById('gov-cost').value);
            if (!isNaN(govCost) && govCost >= 0) {
                item.govCost = govCost;
            }
        }
        
        this.data[this.currentTab].push(item);
        this.saveToStorage();
        document.getElementById('item-form').reset();
        document.getElementById('gov-cost').value = '';
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
        
        // Форматируем цены для отображения
        const formattedPrices = item.prices.map(price => this.formatNumber(price));
        const formattedAvgPrice = this.formatNumber(avgPrice);
        
        // Создаем HTML для карточки
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${this.escapeHtml(item.name)}</h3>
                    ${item.govCost !== undefined ? `<div class="gov-cost">Гос. стоимость: ${this.formatNumber(item.govCost)} ₽</div>` : ''}
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
                        <span class="price-value">${price} ₽</span>
                        <button class="remove-price" data-id="${item.id}" data-index="${index}">×</button>
                    </div>
                `).join('')}
                ${formattedPrices.length === 0 ? '<p class="text-secondary">Нет цен</p>' : ''}
            </div>
            <div class="item-stats">
                <div class="avg-price">Средняя цена: ${formattedAvgPrice} ₽</div>
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
        const priceList = document.getElementById('edit-price-list');
        
        // Устанавливаем данные в форму
        editName.value = item.name;
        
        // Показываем/скрываем поле гос. стоимости
        if (this.currentTab === 'cars') {
            govCostContainer.style.display = 'block';
            editGovCost.value = item.govCost || '';
        } else {
            govCostContainer.style.display = 'none';
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
        const newGovCost = document.getElementById('edit-gov-cost').value;
        
        if (!newName) {
            alert('Название товара не может быть пустым');
            return;
        }
        
        // Находим товар
        const itemIndex = this.data[this.currentTab].findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;
        
        const item = this.data[this.currentTab][itemIndex];
        
        // Обновляем название
        item.name = newName;
        
        // Обновляем гос. стоимость для автомобилей
        if (this.currentTab === 'cars') {
            const govCost = parseFloat(newGovCost);
            if (!isNaN(govCost) && govCost >= 0) {
                item.govCost = govCost;
            } else {
                delete item.govCost;
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
                    return a.name.localeCompare(b.name);
                case 'date':
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'price':
                    const avgA = this.calculateAveragePrice(a.prices);
                    const avgB = this.calculateAveragePrice(b.prices);
                    return avgB - avgA;
                default:
                    return 0;
            }
        });
    },
    
    // Расчет средней цены
    calculateAveragePrice(prices) {
        if (prices.length === 0) return 0;
        const sum = prices.reduce((acc, price) => acc + price, 0);
        return sum / prices.length;
    },
    
    // Форматирование чисел
    formatNumber(num) {
        if (num === 0) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + ' млн';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(2).replace(/\.?0+$/, '') + ' тыс';
        }
        return num.toString();
    },
    
    // Форматирование даты
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },
    
    // Экранирование HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Сохранение данных в localStorage
    saveToStorage() {
        localStorage.setItem('priceTrackerData', JSON.stringify(this.data));
    },
    
    // Загрузка данных из localStorage
    loadFromStorage() {
        const data = localStorage.getItem('priceTrackerData');
        if (data) {
            this.data = JSON.parse(data);
        }
    },
    
    // Обновление состояния пустого списка
    updateEmptyState() {
        const isEmpty = this.data[this.currentTab].length === 0;
        document.getElementById('empty-state').style.display = isEmpty ? 'block' : 'none';
    },
    
    // Экспорт данных в TXT файл
    exportData() {
        let content = 'Price Tracker - Экспорт данных\n';
        content += '=============================\n\n';
        
        // Экспорт для каждого раздела
        const sections = [
            { key: 'skins', title: 'Скины' },
            { key: 'accessories', title: 'Аксессуары' },
            { key: 'cars', title: 'Автомобили' }
        ];
        
        sections.forEach(section => {
            content += `${section.title}\n`;
            content += `${'='.repeat(section.title.length)}\n\n`;
            
            if (this.data[section.key].length === 0) {
                content += 'Нет товаров\n\n';
                return;
            }
            
            this.data[section.key].forEach(item => {
                content += `Название: ${item.name}\n`;
                content += `Добавлено: ${this.formatDate(item.createdAt)}\n`;
                content += `Обновлено: ${this.formatDate(item.updatedAt)}\n`;
                
                if (item.govCost !== undefined) {
                    content += `Гос. стоимость: ${item.govCost} ₽\n`;
                }
                
                if (item.prices.length > 0) {
                    content += `Цены: ${item.prices.join(', ')} ₽\n`;
                    content += `Средняя цена: ${this.calculateAveragePrice(item.prices).toFixed(2)} ₽\n`;
                } else {
                    content += 'Цены: не указаны\n';
                }
                
                content += '\n';
            });
            
            content += '\n';
        });
        
        // Создание и скачивание файла
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-tracker-export-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', () => {
    PriceTracker.init();
});
