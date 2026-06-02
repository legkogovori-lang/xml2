// app.js - основная логика приложения с IndexedDB и поддержкой нескольких отсеков

// Глобальные переменные
let currentCategory = 'shippers';
let currentEditId = null;
let dbSearchTerm = '';
let compartments = []; // Массив для хранения отсеков
let currentUser = null;

// DOM элементы
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const xmlPreview = document.getElementById('xmlPreview');
const statusMsg = document.getElementById('statusMsg');
const refreshDbBtn = document.getElementById('refreshDbBtn');
const addEntityBtn = document.getElementById('addEntityBtn');
const modal = document.getElementById('entityModal');
const modalTitle = document.getElementById('modalTitle');
const modalFields = document.getElementById('modalFields');
const saveEntityBtn = document.getElementById('saveEntityBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const closeModalBtn = document.querySelector('.close-modal');

// Хранилище для input полей и выбранных объектов
const inputs = {};
const selectedItems = {};

// Получение текущего пользователя из sessionStorage
function loadCurrentUser() {
    const userData = sessionStorage.getItem('etrn_user');
    if (userData) {
        try {
            currentUser = JSON.parse(userData);
            if (currentUser.expiredMessage) {
                setTimeout(() => {
                    if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${currentUser.expiredMessage}`;
                }, 500);
            }
            displayUserInfo();
        } catch(e) {
            console.error('Ошибка загрузки пользователя', e);
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
}

function displayUserInfo() {
    if (!currentUser) return;
    
    const userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';
    userInfoDiv.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <span>${currentUser.displayName || currentUser.login}</span>
        ${currentUser.role === 'demo' || currentUser.isDemo ? '<span class="demo-badge">ДЕМО</span>' : ''}
        <button class="logout-btn" id="logoutBtn" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
    `;
    
    const header = document.querySelector('.glass-header');
    if (header) {
        const existingUserInfo = header.querySelector('.user-info');
        if (existingUserInfo) existingUserInfo.remove();
        
        const headerActions = header.querySelector('.header-actions');
        if (headerActions) {
            headerActions.insertBefore(userInfoDiv, headerActions.firstChild);
        } else {
            header.appendChild(userInfoDiv);
        }
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('etrn_user');
            window.location.href = 'index.html';
        });
    }
    
    if (currentUser.role === 'demo' || currentUser.isDemo) {
        showDemoLimits();
    }
}

function showDemoLimits() {
    const dbPanel = document.querySelector('.db-panel');
    if (dbPanel && !dbPanel.querySelector('.demo-warning')) {
        const demoWarning = document.createElement('div');
        demoWarning.className = 'demo-warning';
        demoWarning.innerHTML = `
            <i class="fas fa-info-circle"></i>
            ДЕМО-РЕЖИМ: не более 5 записей в каждой категории.
        `;
        dbPanel.insertBefore(demoWarning, dbPanel.querySelector('.db-tabs'));
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Загрузка базы данных...';
    
    await initDatabase();
    createSearchInputs();
    await populateAllSelects();
    await renderDatabasePanel();
    attachEventListeners();
    initCompartments();
    
    // Установка даты по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const shipmentDateInput = document.getElementById('shipmentDate');
    if (shipmentDateInput) shipmentDateInput.value = today;
    
    if (statusMsg) {
        statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> База данных IndexedDB готова';
        setTimeout(() => {
            if (statusMsg.innerHTML.includes('готова')) {
                statusMsg.innerHTML = '';
            }
        }, 2000);
    }
});

// Кнопка возврата на главную
const backBtn = document.getElementById('backToLandingBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Инициализация отсеков
function initCompartments() {
    addCompartment();
}

// Добавление нового отсека
function addCompartment() {
    const container = document.getElementById('compartmentsContainer');
    if (!container) return;
    
    const compartmentId = Date.now();
    
    const compartmentDiv = document.createElement('div');
    compartmentDiv.className = 'compartment-card';
    compartmentDiv.dataset.id = compartmentId;
    compartmentDiv.style.cssText = 'background: rgba(255,255,255,0.5); border-radius: 16px; padding: 16px; margin-bottom: 16px; border: 1px solid rgba(44,122,177,0.2);';
    
    compartmentDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="color: #1a5d85;">Отсек ${compartments.length + 1}</strong>
            <button type="button" class="remove-compartment-btn" style="background: rgba(200,70,70,0.1); border: none; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; color: #c04444;" onclick="removeCompartment(${compartmentId})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Продукт</label>
                <input type="text" id="productInput_${compartmentId}" class="glass-input" placeholder="-- Введите для поиска --" autocomplete="off">
            </div>
            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Код ТН ВЭД</label>
                <input type="text" id="tnvedCode_${compartmentId}" class="glass-input" placeholder="Определяется из продукта" readonly style="background:#f0f0f0;">
            </div>
        </div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <div style="flex: 1;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Масса (тонн)</label>
                <input type="number" step="0.001" id="weight_${compartmentId}" class="glass-input" placeholder="0.000">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Количество мест</label>
                <input type="number" step="1" id="places_${compartmentId}" class="glass-input" placeholder="1" value="1">
            </div>
        </div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px;">
            <div style="flex: 1;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Плотность (кг/м³)</label>
                <input type="text" id="density_${compartmentId}" class="glass-input" placeholder="0.845">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.7rem; color: #4a6f8a;">Температура (°C)</label>
                <input type="text" id="temp_${compartmentId}" class="glass-input" placeholder="18.5">
            </div>
        </div>
    `;
    
    container.appendChild(compartmentDiv);
    
    compartments.push({
        id: compartmentId,
        product: null,
        tnved: '',
        weight: '',
        places: 1,
        density: '0.845',
        temp: '18.5'
    });
    
    setupProductSearchForCompartment(compartmentId);
    updateCompartmentTitles();
}

// Настройка поиска продукта для конкретного отсека
async function setupProductSearchForCompartment(compartmentId) {
    const productInput = document.getElementById(`productInput_${compartmentId}`);
    if (!productInput) return;
    
    const products = await getCategory('products');
    const datalistId = `productDatalist_${compartmentId}`;
    
    const oldDatalist = document.getElementById(datalistId);
    if (oldDatalist) oldDatalist.remove();
    
    const datalist = document.createElement('datalist');
    datalist.id = datalistId;
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.name;
        option.setAttribute('data-json', JSON.stringify(product));
        datalist.appendChild(option);
    });
    
    document.body.appendChild(datalist);
    productInput.setAttribute('list', datalistId);
    
    productInput.oninput = function(e) {
        const value = this.value;
        const matchedOption = Array.from(datalist.options).find(opt => opt.value === value);
        const compartment = compartments.find(c => c.id === compartmentId);
        
        if (matchedOption && compartment) {
            const product = JSON.parse(matchedOption.getAttribute('data-json'));
            compartment.product = product;
            
            const tnvedInput = document.getElementById(`tnvedCode_${compartmentId}`);
            if (tnvedInput && product.defaultTnved) {
                tnvedInput.value = product.defaultTnved;
                compartment.tnved = product.defaultTnved;
            }
            
            const densityInput = document.getElementById(`density_${compartmentId}`);
            if (densityInput && product.densityDefault) {
                densityInput.value = product.densityDefault;
                compartment.density = product.densityDefault;
            }
        } else if (compartment) {
            compartment.product = null;
            const tnvedInput = document.getElementById(`tnvedCode_${compartmentId}`);
            if (tnvedInput) tnvedInput.value = '';
            compartment.tnved = '';
        }
    };
    
    const weightInput = document.getElementById(`weight_${compartmentId}`);
    if (weightInput) {
        weightInput.oninput = function() {
            const compartment = compartments.find(c => c.id === compartmentId);
            if (compartment) compartment.weight = this.value;
        };
    }
    
    const placesInput = document.getElementById(`places_${compartmentId}`);
    if (placesInput) {
        placesInput.oninput = function() {
            const compartment = compartments.find(c => c.id === compartmentId);
            if (compartment) compartment.places = parseInt(this.value) || 1;
        };
    }
    
    const densityInput = document.getElementById(`density_${compartmentId}`);
    if (densityInput) {
        densityInput.oninput = function() {
            const compartment = compartments.find(c => c.id === compartmentId);
            if (compartment) compartment.density = this.value;
        };
    }
    
    const tempInput = document.getElementById(`temp_${compartmentId}`);
    if (tempInput) {
        tempInput.oninput = function() {
            const compartment = compartments.find(c => c.id === compartmentId);
            if (compartment) compartment.temp = this.value;
        };
    }
}

// Удаление отсека
function removeCompartment(id) {
    if (compartments.length <= 1) {
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Должен быть хотя бы один отсек';
        setTimeout(() => {
            if (statusMsg && statusMsg.innerHTML.includes('хотя бы один')) {
                statusMsg.innerHTML = '';
            }
        }, 2000);
        return;
    }
    
    const index = compartments.findIndex(c => c.id === id);
    if (index !== -1) {
        compartments.splice(index, 1);
        const compartmentDiv = document.querySelector(`.compartment-card[data-id="${id}"]`);
        if (compartmentDiv) compartmentDiv.remove();
        updateCompartmentTitles();
    }
}

// Обновление заголовков отсеков
function updateCompartmentTitles() {
    const cards = document.querySelectorAll('.compartment-card');
    cards.forEach((card, idx) => {
        const title = card.querySelector('strong');
        if (title) {
            title.textContent = `Отсек ${idx + 1}`;
        }
    });
}

// Создание input полей с поиском
function createSearchInputs() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    
    categories.forEach(category => {
        const container = document.getElementById(`${category}Container`);
        if (container) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `${category}Input`;
            input.className = 'glass-input';
            input.placeholder = '-- Введите для поиска --';
            input.autocomplete = 'off';
            container.innerHTML = '';
            container.appendChild(input);
            inputs[category] = input;
            selectedItems[category] = null;
        }
    });
}

// Заполнение всех выпадающих списков
async function populateAllSelects() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    
    for (const category of categories) {
        const items = await getCategory(category);
        const datalistId = `${category}Datalist`;
        
        const oldDatalist = document.getElementById(datalistId);
        if (oldDatalist) oldDatalist.remove();
        
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        
        items.forEach(item => {
            const option = document.createElement('option');
            let displayText = '';
            switch(category) {
                case 'shippers': displayText = `${item.name} (${item.inn})`; break;
                case 'consignees': displayText = `${item.name} (${item.inn})`; break;
                case 'carriers': displayText = `${item.name} (${item.inn})`; break;
                case 'drivers': displayText = `${item.fullName} / ${item.license}`; break;
                case 'signers': displayText = `${item.fio} (${item.position})`; break;
                case 'vehicles': displayText = `${item.regNumber}`; break;
                case 'products': displayText = `${item.name}`; break;
            }
            option.value = displayText;
            option.setAttribute('data-json', JSON.stringify(item));
            datalist.appendChild(option);
        });
        
        document.body.appendChild(datalist);
        
        if (inputs[category]) {
            inputs[category].setAttribute('list', datalistId);
            
            inputs[category].oninput = function(e) {
                const value = this.value;
                const matchedOption = Array.from(datalist.options).find(opt => opt.value === value);
                if (matchedOption) {
                    selectedItems[category] = JSON.parse(matchedOption.getAttribute('data-json'));
                } else {
                    selectedItems[category] = null;
                }
            };
        }
    }
}

// Получение значения из поискового поля
function getSelectedFromSearch(category) {
    return selectedItems[category] || {};
}

// Рендер левой панели с поиском
async function renderDatabasePanel() {
    const dbContent = document.getElementById('dbContent');
    if (!dbContent) return;
    
    dbContent.innerHTML = `
        <div class="db-search-wrapper">
            <input type="text" id="dbSearchInput" class="db-search-input" placeholder="🔍 Поиск по категории..." value="${escapeHtml(dbSearchTerm)}">
        </div>
        <div class="db-category-items" id="dbCategoryItems">
            <div class="loading-spinner">Загрузка...</div>
        </div>
    `;
    
    let items;
    if (dbSearchTerm) {
        items = await searchInCategory(currentCategory, dbSearchTerm);
    } else {
        items = await getCategory(currentCategory);
    }
    
    const itemsContainer = document.getElementById('dbCategoryItems');
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state">📭 Нет записей. Нажмите "Добавить"</div>';
        } else {
            itemsContainer.innerHTML = items.map(item => `
                <div class="db-item" data-id="${item.id}" data-category="${currentCategory}">
                    <div class="db-item-info">
                        <strong>${escapeHtml(getItemDisplay(currentCategory, item))}</strong>
                        <small>${escapeHtml(getItemDetails(currentCategory, item))}</small>
                    </div>
                    <button class="delete-item" data-id="${item.id}" data-category="${currentCategory}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');
        }
    }
    
    const searchInput = document.getElementById('dbSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            dbSearchTerm = e.target.value;
            await renderDatabasePanel();
        });
    }
    
    if (itemsContainer) {
        itemsContainer.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-item');
            if (deleteBtn) {
                e.stopPropagation();
                const id = parseInt(deleteBtn.dataset.id);
                const category = deleteBtn.dataset.category;
                if (confirm('Удалить запись?')) {
                    try {
                        await deleteItem(category, id);
                        if (statusMsg) statusMsg.innerHTML = `✅ Запись удалена`;
                        await renderDatabasePanel();
                        await populateAllSelects();
                        setTimeout(() => {
                            if (statusMsg && statusMsg.innerHTML.includes('удалена')) {
                                statusMsg.innerHTML = '';
                            }
                        }, 2000);
                    } catch (error) {
                        if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка удаления: ${error.message}`;
                    }
                }
            }
        });
    }
    
    if (itemsContainer) {
        itemsContainer.addEventListener('click', async (e) => {
            const itemDiv = e.target.closest('.db-item');
            if (!itemDiv) return;
            if (e.target.closest('.delete-item')) return;
            
            const id = parseInt(itemDiv.dataset.id);
            const category = itemDiv.dataset.category;
            const itemsList = await getCategory(category);
            const found = itemsList.find(i => i.id === id);
            if (found) {
                quickFillByCategory(category, found);
                if (statusMsg) statusMsg.innerHTML = `📋 Данные загружены в форму`;
                setTimeout(() => {
                    if (statusMsg && statusMsg.innerHTML.includes('загружены')) {
                        statusMsg.innerHTML = '';
                    }
                }, 2000);
            }
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getItemDisplay(category, item) {
    switch(category) {
        case 'shippers': return item.name;
        case 'consignees': return item.name;
        case 'carriers': return item.name;
        case 'drivers': return item.fullName;
        case 'signers': return item.fio;
        case 'vehicles': return item.regNumber;
        case 'products': return item.name;
        default: return '';
    }
}

function getItemDetails(category, item) {
    switch(category) {
        case 'shippers': return `ИНН: ${item.inn || ''}`;
        case 'consignees': return `ИНН: ${item.inn || ''}`;
        case 'carriers': return `ИНН: ${item.inn || ''}`;
        case 'drivers': return `уд. ${item.license || ''}`;
        case 'signers': return item.position || '';
        case 'vehicles': return item.nationality || '';
        case 'products': return `ТН ВЭД: ${item.defaultTnved || ''}`;
        default: return '';
    }
}

function quickFillByCategory(category, data) {
    if (!inputs[category]) return;
    
    let displayText = '';
    switch(category) {
        case 'shippers': displayText = `${data.name} (${data.inn})`; break;
        case 'consignees': displayText = `${data.name} (${data.inn})`; break;
        case 'carriers': displayText = `${data.name} (${data.inn})`; break;
        case 'drivers': displayText = `${data.fullName} / ${data.license}`; break;
        case 'signers': displayText = `${data.fio} (${data.position})`; break;
        case 'vehicles': displayText = `${data.regNumber}`; break;
        case 'products': displayText = `${data.name}`; break;
    }
    
    inputs[category].value = displayText;
    selectedItems[category] = data;
}

// Форматирование даты для XML
function formatDateForXML(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

// Генерация GUID
function generateGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }).toUpperCase();
}

// Генерация XML по формату ФНС (Приказ № ЕД-7-26/383@)
function generateXML() {
    try {
        const shipper = getSelectedFromSearch('shippers');
        const consignee = getSelectedFromSearch('consignees');
        const carrier = getSelectedFromSearch('carriers');
        const driver = getSelectedFromSearch('drivers');
        const signer = getSelectedFromSearch('signers');
        const vehicle = getSelectedFromSearch('vehicles');
        
        // Получаем основные данные формы
        const ttnNumberInput = document.getElementById('ttnNumber');
        const shipmentDateInput = document.getElementById('shipmentDate');
        const shipPointInput = document.getElementById('shipmentPoint');
        const contractNumberInput = document.getElementById('contractNumber');
        const contractDateInput = document.getElementById('contractDate');
        const addressIndexInput = document.getElementById('addressIndex');
        const addressRegionInput = document.getElementById('addressRegion');
        const addressStreetInput = document.getElementById('addressStreet');
        const addressHouseInput = document.getElementById('addressHouse');
        const addressBuildingInput = document.getElementById('addressBuilding');
        const deliveryAddressIndexInput = document.getElementById('deliveryAddressIndex');
        const deliveryAddressRegionInput = document.getElementById('deliveryAddressRegion');
        const cargoValueInput = document.getElementById('cargoValue');
        const loadMethodInput = document.getElementById('loadMethod');
        
        const ttnNumber = ttnNumberInput?.value.trim() || `21323`;
        const shipmentDate = shipmentDateInput?.value || new Date().toISOString().split('T')[0];
        const shipPoint = shipPointInput?.value || "Резервуарный парк";
        const contractNumber = contractNumberInput?.value.trim() || "1234";
        const contractDate = contractDateInput?.value || shipmentDate;
        const addressIndex = addressIndexInput?.value || "109472";
        const addressRegion = addressRegionInput?.value || "77";
        const addressStreet = addressStreetInput?.value || "ВОЛГОГРАДСКИЙ ПР-КТ";
        const addressHouse = addressHouseInput?.value || "164";
        const addressBuilding = addressBuildingInput?.value || "3";
        const deliveryAddressIndex = deliveryAddressIndexInput?.value || "420111";
        const deliveryAddressRegion = deliveryAddressRegionInput?.value || "03";
        const cargoValue = cargoValueInput?.value || "120000";
        const loadMethod = loadMethodInput?.value || "02";
        
        // Проверка обязательных полей
        if (!shipper.name) throw new Error("Выберите грузоотправителя");
        if (!consignee.name) throw new Error("Выберите грузополучателя");
        if (!carrier.name) throw new Error("Выберите перевозчика");
        if (!driver.fullName) throw new Error("Выберите водителя");
        
        // Собираем данные по отсекам
        const compartmentsData = [];
        let totalWeight = 0;
        let totalPlaces = 0;
        
        for (const comp of compartments) {
            const weight = parseFloat(comp.weight) || 0;
            const places = parseInt(comp.places) || 1;
            totalWeight += weight;
            totalPlaces += places;
            
            compartmentsData.push({
                productName: comp.product ? comp.product.name : 'Нефть сырая',
                tnved: comp.tnved || comp.product?.defaultTnved || '2709009009',
                weight: weight.toFixed(3),
                places: places,
                density: comp.density || '0.845',
                temp: comp.temp || '18.5'
            });
        }
        
        if (compartmentsData.length === 0) {
            throw new Error("Добавьте хотя бы один отсек с грузом");
        }
        
        // Форматирование дат
        const formattedShipmentDate = formatDateForXML(shipmentDate);
        const formattedContractDate = formatDateForXML(contractDate);
        const now = new Date();
        const nowDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
        const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        // Генерация ID файла
        const guid1 = generateGuid();
        const guid2 = generateGuid();
        const guid3 = generateGuid();
        const dateForFile = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`;
        const fileId = `ON_TRNVPRGO_${guid1}_${guid2}_0_${dateForFile}_${guid3}`;
        
        // Время для погрузки
        const nowTimeISO = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}T${nowTime}+03:00`;
        
        // Разбиваем ФИО водителя
        const driverNameParts = (driver.fullName || '').split(' ');
        const driverLastName = driverNameParts[0] || '';
        const driverFirstName = driverNameParts[1] || '';
        
        // Разбиваем ФИО подписанта
        const signerNameParts = (signer.fio || '').split(' ');
        const signerLastName = signerNameParts[0] || '';
        const signerFirstName = signerNameParts[1] || '';
        const signerPatronymic = signerNameParts[2] || '';
        
        // Формируем регионы
        const shipperRegionName = addressRegion === '77' ? 'г. Москва' : '';
        const deliveryRegionName = deliveryAddressRegion === '03' ? 'Республика Башкортостан' : '';
        
        // Генерация XML по образцу
        let xml = `<?xml version="1.0" encoding="windows-1251"?>\n`;
        xml += `<Файл xmlns="http://www.nalog.ru/EDO/TTN/TransportationCustomer/033/..." \n`;
        xml += `      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
        xml += `      ИдФайл="${escapeXml(fileId)}"\n`;
        xml += `      ВерсПрог="ЭТРН.ONLINE V 1.01"\n`;
        xml += `      ВерсФорм="5.01">\n`;
        xml += `    <Документ КНД="1110430" \n`;
        xml += `              НаимТрН="3" \n`;
        xml += `              ДатаИнфГО="${nowDate}" \n`;
        xml += `              ВрИнфГО="${nowTime}">\n`;
        xml += `        <СодИнфГО СодОпер="Лицом, осуществляющим погрузку груза, при указанных обстоятельствах передан водителю груз с указанными характеристиками" \n`;
        xml += `                  НомерТрН="${escapeXml(ttnNumber)}" \n`;
        xml += `                  ДатаТрН="${formattedShipmentDate}" \n`;
        xml += `                  НомЗак="${escapeXml(contractNumber)}" \n`;
        xml += `                  ДатаЗак="${formattedContractDate}">\n`;
        xml += `            \n`;
        xml += `            <!-- Сведения о грузоотправителе -->\n`;
        xml += `            <СвГО>\n`;
        xml += `                <РеквГО>\n`;
        xml += `                    <ИдСв>\n`;
        xml += `                        <СвЮЛУч>\n`;
        xml += `                            <НаимОрг>${escapeXml(shipper.name)}</НаимОрг>\n`;
        xml += `                            <ИННЮЛ>${escapeXml(shipper.inn || '')}</ИННЮЛ>\n`;
        xml += `                            <КПП>${escapeXml(shipper.kpp || '')}</КПП>\n`;
        xml += `                        </СвЮЛУч>\n`;
        xml += `                    </ИдСв>\n`;
        xml += `                    <Адрес>\n`;
        xml += `                        <АдрРФ>\n`;
        xml += `                            <Индекс>${escapeXml(addressIndex)}</Индекс>\n`;
        xml += `                            <КодРегион>${escapeXml(addressRegion)}</КодРегион>\n`;
        if (shipperRegionName) xml += `                            <НаимРегион>${escapeXml(shipperRegionName)}</НаимРегион>\n`;
        xml += `                            <Улица>${escapeXml(addressStreet)}</Улица>\n`;
        xml += `                            <Дом>${escapeXml(addressHouse)}</Дом>\n`;
        xml += `                            <Корпус>${escapeXml(addressBuilding)}</Корпус>\n`;
        xml += `                        </АдрРФ>\n`;
        xml += `                    </Адрес>\n`;
        xml += `                    <Контакт>\n`;
        xml += `                        <Тлф>${escapeXml(shipper.phone || '')}</Тлф>\n`;
        xml += `                    </Контакт>\n`;
        xml += `                </РеквГО>\n`;
        xml += `            </СвГО>\n`;
        xml += `\n`;
        xml += `            <!-- Сведения о грузополучателе -->\n`;
        xml += `            <СвГП>\n`;
        xml += `                <РеквГП>\n`;
        xml += `                    <ИдСв>\n`;
        xml += `                        <СвЮЛУч>\n`;
        xml += `                            <НаимОрг>${escapeXml(consignee.name)}</НаимОрг>\n`;
        xml += `                            <ИННЮЛ>${escapeXml(consignee.inn || '')}</ИННЮЛ>\n`;
        xml += `                            <КПП>${escapeXml(consignee.kpp || '')}</КПП>\n`;
        xml += `                        </СвЮЛУч>\n`;
        xml += `                    </ИдСв>\n`;
        xml += `                    <Контакт>\n`;
        xml += `                        <Тлф>${escapeXml(consignee.phone || '')}</Тлф>\n`;
        xml += `                    </Контакт>\n`;
        xml += `                </РеквГП>\n`;
        xml += `                <АдресДост>\n`;
        xml += `                    <АдрРФ>\n`;
        xml += `                        <Индекс>${escapeXml(deliveryAddressIndex)}</Индекс>\n`;
        xml += `                        <КодРегион>${escapeXml(deliveryAddressRegion)}</КодРегион>\n`;
        if (deliveryRegionName) xml += `                        <НаимРегион>${escapeXml(deliveryRegionName)}</НаимРегион>\n`;
        xml += `                        <Улица>${escapeXml(addressStreet)}</Улица>\n`;
        xml += `                        <Дом>1</Дом>\n`;
        xml += `                    </АдрРФ>\n`;
        xml += `                </АдресДост>\n`;
        xml += `            </СвГП>\n`;
        xml += `\n`;
        
        // Для каждого отсека добавляем СвГруз
        for (let i = 0; i < compartmentsData.length; i++) {
            const cargo = compartmentsData[i];
            xml += `            <!-- Сведения о грузе -->\n`;
            xml += `            <СвГруз>\n`;
            xml += `                <ОпГруз НаимГруз="${escapeXml(cargo.productName)}" \n`;
            xml += `                        СостГруз="Без нареканий" \n`;
            xml += `                        СпУпак="0" \n`;
            xml += `                        ВидТар="00" \n`;
            xml += `                        КолМестГр="${cargo.places}">\n`;
            xml += `                    <Марк>Отсутствует</Марк>\n`;
            xml += `                    <ВесГруз>${cargo.weight}</ВесГруз>\n`;
            xml += `                    <ЦенГруз>\n`;
            xml += `                        <СтЦенГр>${escapeXml(cargoValue)}</СтЦенГр>\n`;
            xml += `                        <КодОКВ>643</КодОКВ>\n`;
            xml += `                        <НаимОКВ>Российский рубль</НаимОКВ>\n`;
            xml += `                    </ЦенГруз>\n`;
            xml += `                </ОпГруз>\n`;
            xml += `                <ФизХимПок>\n`;
            xml += `                    <Показ>\n`;
            xml += `                        <НаимПоказ>Плотность при 15°C</НаимПоказ>\n`;
            xml += `                        <ЗначПоказ>${cargo.density}</ЗначПоказ>\n`;
            xml += `                        <ЕдПоказ>кг/м³</ЕдПоказ>\n`;
            xml += `                    </Показ>\n`;
            xml += `                    <Показ>\n`;
            xml += `                        <НаимПоказ>Температура налива</НаимПоказ>\n`;
            xml += `                        <ЗначПоказ>${cargo.temp}</ЗначПоказ>\n`;
            xml += `                        <ЕдПоказ>°C</ЕдПоказ>\n`;
            xml += `                    </Показ>\n`;
            xml += `                </ФизХимПок>\n`;
            xml += `            </СвГруз>\n`;
            xml += `\n`;
        }
        
        xml += `            <!-- Указания грузоотправителя -->\n`;
        xml += `            <УказГО УкНормПрвз="Отсутствуют">\n`;
        xml += `                <СвПА ЛицоПА="Грузоотправитель" \n`;
        xml += `                      СпосПерУкПА="Электронное уведомление перевозчика о переадресовке">\n`;
        xml += `                    <КонтПА>\n`;
        xml += `                        <Тлф>${escapeXml(shipper.phone || '')}</Тлф>\n`;
        xml += `                    </КонтПА>\n`;
        xml += `                </СвПА>\n`;
        xml += `            </УказГО>\n`;
        xml += `\n`;
        xml += `            <!-- Сведения о перевозчике -->\n`;
        xml += `            <СвПер>\n`;
        xml += `                <ИдСв>\n`;
        xml += `                    <СвЮЛУч>\n`;
        xml += `                        <НаимОрг>${escapeXml(carrier.name)}</НаимОрг>\n`;
        xml += `                        <ИННЮЛ>${escapeXml(carrier.inn || '')}</ИННЮЛ>\n`;
        xml += `                        <КПП>${escapeXml(carrier.kpp || '')}</КПП>\n`;
        xml += `                    </СвЮЛУч>\n`;
        xml += `                </ИдСв>\n`;
        xml += `                <Адрес>\n`;
        xml += `                    <АдрРФ>\n`;
        xml += `                        <Индекс>${escapeXml(addressIndex)}</Индекс>\n`;
        xml += `                        <КодРегион>${escapeXml(addressRegion)}</КодРегион>\n`;
        if (shipperRegionName) xml += `                        <НаимРегион>${escapeXml(shipperRegionName)}</НаимРегион>\n`;
        xml += `                    </АдрРФ>\n`;
        xml += `                </Адрес>\n`;
        xml += `                <Контакт>\n`;
        xml += `                    <Тлф>${escapeXml(carrier.phone || '')}</Тлф>\n`;
        xml += `                </Контакт>\n`;
        xml += `            </СвПер>\n`;
        xml += `\n`;
        xml += `            <!-- Сведения о водителе -->\n`;
        xml += `            <СвВод ИННФЛ="${escapeXml(driver.inn || '')}">\n`;
        xml += `                <Тлф>${escapeXml(driver.phone || '')}</Тлф>\n`;
        xml += `                <ФИО>\n`;
        xml += `                    <Фамилия>${escapeXml(driverLastName)}</Фамилия>\n`;
        xml += `                    <Имя>${escapeXml(driverFirstName)}</Имя>\n`;
        xml += `                </ФИО>\n`;
        xml += `            </СвВод>\n`;
        xml += `\n`;
        xml += `            <!-- Сведения о транспортном средстве -->\n`;
        xml += `            <СвТС>\n`;
        xml += `                <ТС РегНомер="${escapeXml(vehicle.regNumber || '')}" ТипВлад="1">\n`;
        xml += `                    <ПарТС Тип="${escapeXml(vehicle.brand || '')}" Марка="${escapeXml(vehicle.brand || '')}" Грузопод="${escapeXml(vehicle.loadCapacity || '20000')}" Вместим="${escapeXml(vehicle.capacity || '20000')}" />\n`;
        xml += `                </ТС>\n`;
        xml += `            </СвТС>\n`;
        xml += `\n`;
        xml += `            <!-- Сведения о погрузке -->\n`;
        xml += `            <СвПогруз ЗаявПогр="${nowTimeISO}" \n`;
        xml += `                      НалКоорТочВрЗаяв="0" \n`;
        xml += `                      ФДатВрПриб="${nowTimeISO}" \n`;
        xml += `                      НалКоорТочВрФПогр="0" \n`;
        xml += `                      ФДатВрУбыт="${nowTimeISO}" \n`;
        xml += `                      НалКоорТочВрФУбыт="0" \n`;
        xml += `                      МасБрутОтрг="${totalWeight.toFixed(3)}" \n`;
        xml += `                      МетОпМасс="${escapeXml(loadMethod)}" \n`;
        xml += `                      КолМестПрием="${totalPlaces}">\n`;
        xml += `                <ФАдресПогр>\n`;
        xml += `                    <АдрРФ>\n`;
        xml += `                        <Индекс>${escapeXml(addressIndex)}</Индекс>\n`;
        xml += `                        <КодРегион>${escapeXml(addressRegion)}</КодРегион>\n`;
        xml += `                        <Улица>${escapeXml(addressStreet)}</Улица>\n`;
        xml += `                        <Дом>${escapeXml(addressHouse)}</Дом>\n`;
        xml += `                        <Корпус>${escapeXml(addressBuilding)}</Корпус>\n`;
        xml += `                    </АдрРФ>\n`;
        xml += `                </ФАдресПогр>\n`;
        xml += `                <СвЛицПогрГр СовпГОП="1">\n`;
        xml += `                    <ИдРекГО>\n`;
        xml += `                        <ИННЮЛ>${escapeXml(shipper.inn || '')}</ИННЮЛ>\n`;
        xml += `                    </ИдРекГО>\n`;
        xml += `                </СвЛицПогрГр>\n`;
        xml += `                <ВладИнфра СовпГОВ="3" ОбНетИнфОВлад="Нет данных" />\n`;
        xml += `            </СвПогруз>\n`;
        xml += `        </СодИнфГО>\n`;
        xml += `        <Подписант СтатПод="1">\n`;
        xml += `            <ФИО>\n`;
        xml += `                <Фамилия>${escapeXml(signerLastName)}</Фамилия>\n`;
        xml += `                <Имя>${escapeXml(signerFirstName)}</Имя>\n`;
        if (signerPatronymic) xml += `                <Отчество>${escapeXml(signerPatronymic)}</Отчество>\n`;
        xml += `            </ФИО>\n`;
        xml += `        </Подписант>\n`;
        xml += `    </Документ>\n`;
        xml += `</Файл>`;
        
        if (xmlPreview) xmlPreview.innerText = xml;
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> XML успешно сформирован по формату ФНС';
        return xml;
    } catch(e) {
        if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка: ${e.message}`;
        console.error('XML Generation Error:', e);
        return null;
    }
}

function escapeXml(str) {
    if (!str) return '';
    return str.replace(/[<>&'"]/g, function(m) {
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '&') return '&amp;';
        if (m === "'") return '&apos;';
        if (m === '"') return '&quot;';
        return m;
    });
}

function downloadXML() {
    const xml = generateXML();
    if (xml) {
        const now = new Date();
        const dateForFile = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`;
        const fileName = `ON_TRNVPRGO_${generateGuid()}_${generateGuid()}_0_${dateForFile}_${generateGuid()}`;
        const blob = new Blob(["\uFEFF" + xml], {type: 'application/xml;charset=UTF-8'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `${fileName}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-download"></i> Файл скачан в формате ФНС';
    }
}

function copyXML() {
    const xml = xmlPreview?.innerText;
    if (xml && !xml.includes('Заполните')) {
        navigator.clipboard.writeText(xml);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-copy"></i> XML скопирован';
    } else {
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Сначала сгенерируйте XML';
    }
}

// Modal handlers for adding entities
function openAddModal() {
    currentEditId = null;
    if (modalTitle) modalTitle.innerText = `Добавить запись в категорию: ${getCategoryNameRu(currentCategory)}`;
    
    let fieldsHtml = '';
    switch(currentCategory) {
        case 'shippers':
            fieldsHtml = `
                <input type="text" id="field_inn" placeholder="ИНН (10-12 цифр)" required>
                <input type="text" id="field_kpp" placeholder="КПП">
                <input type="text" id="field_name" placeholder="Наименование организации" required>
                <input type="text" id="field_address" placeholder="Адрес">
                <input type="text" id="field_phone" placeholder="Телефон">
            `;
            break;
        case 'consignees':
            fieldsHtml = `
                <input type="text" id="field_inn" placeholder="ИНН" required>
                <input type="text" id="field_kpp" placeholder="КПП">
                <input type="text" id="field_name" placeholder="Наименование" required>
                <input type="text" id="field_address" placeholder="Адрес">
                <input type="text" id="field_phone" placeholder="Телефон">
            `;
            break;
        case 'carriers':
            fieldsHtml = `
                <input type="text" id="field_inn" placeholder="ИНН" required>
                <input type="text" id="field_kpp" placeholder="КПП">
                <input type="text" id="field_name" placeholder="Наименование" required>
                <input type="text" id="field_transportType" placeholder="Вид транспорта" value="Автомобильный">
                <input type="text" id="field_address" placeholder="Адрес">
                <input type="text" id="field_phone" placeholder="Телефон">
            `;
            break;
        case 'drivers':
            fieldsHtml = `
                <input type="text" id="field_fullName" placeholder="ФИО полностью" required>
                <input type="text" id="field_license" placeholder="Номер удостоверения" required>
                <input type="text" id="field_inn" placeholder="ИНН (12 цифр)">
                <input type="text" id="field_phone" placeholder="Телефон">
            `;
            break;
        case 'signers':
            fieldsHtml = `
                <input type="text" id="field_fio" placeholder="ФИО" required>
                <input type="text" id="field_position" placeholder="Должность" required>
            `;
            break;
        case 'vehicles':
            fieldsHtml = `
                <input type="text" id="field_regNumber" placeholder="Рег. номер" required>
                <input type="text" id="field_nationality" placeholder="Национальность" value="RUS">
                <input type="text" id="field_brand" placeholder="Марка/Тип ТС">
                <input type="text" id="field_capacity" placeholder="Вместимость (л)">
                <input type="text" id="field_loadCapacity" placeholder="Грузоподъемность (кг)">
            `;
            break;
        case 'products':
            fieldsHtml = `
                <input type="text" id="field_name" placeholder="Наименование продукта" required>
                <input type="text" id="field_tnved" placeholder="Код ТН ВЭД" value="2709009009">
                <input type="text" id="field_density" placeholder="Плотность по умолчанию" value="0.845">
            `;
            break;
    }
    if (modalFields) modalFields.innerHTML = fieldsHtml;
    if (modal) modal.style.display = 'flex';
}

async function saveNewEntity() {
    let newItem = {};
    switch(currentCategory) {
        case 'shippers':
            newItem = {
                inn: document.getElementById('field_inn')?.value,
                kpp: document.getElementById('field_kpp')?.value,
                name: document.getElementById('field_name')?.value,
                address: document.getElementById('field_address')?.value,
                phone: document.getElementById('field_phone')?.value
            };
            if (!newItem.name || !newItem.inn) { alert('Заполните название и ИНН'); return; }
            break;
        case 'consignees':
            newItem = {
                inn: document.getElementById('field_inn')?.value,
                kpp: document.getElementById('field_kpp')?.value,
                name: document.getElementById('field_name')?.value,
                address: document.getElementById('field_address')?.value,
                phone: document.getElementById('field_phone')?.value
            };
            if (!newItem.name) { alert('Заполните название'); return; }
            break;
        case 'carriers':
            newItem = {
                inn: document.getElementById('field_inn')?.value,
                kpp: document.getElementById('field_kpp')?.value,
                name: document.getElementById('field_name')?.value,
                transportType: document.getElementById('field_transportType')?.value,
                address: document.getElementById('field_address')?.value,
                phone: document.getElementById('field_phone')?.value
            };
            if (!newItem.name) { alert('Заполните название'); return; }
            break;
        case 'drivers':
            newItem = {
                fullName: document.getElementById('field_fullName')?.value,
                license: document.getElementById('field_license')?.value,
                inn: document.getElementById('field_inn')?.value,
                phone: document.getElementById('field_phone')?.value
            };
            if (!newItem.fullName) { alert('Введите ФИО'); return; }
            break;
        case 'signers':
            newItem = {
                fio: document.getElementById('field_fio')?.value,
                position: document.getElementById('field_position')?.value
            };
            if (!newItem.fio) { alert('Введите ФИО'); return; }
            break;
        case 'vehicles':
            newItem = {
                regNumber: document.getElementById('field_regNumber')?.value,
                nationality: document.getElementById('field_nationality')?.value || 'RUS',
                brand: document.getElementById('field_brand')?.value,
                capacity: document.getElementById('field_capacity')?.value,
                loadCapacity: document.getElementById('field_loadCapacity')?.value
            };
            if (!newItem.regNumber) { alert('Введите госномер'); return; }
            break;
        case 'products':
            newItem = {
                name: document.getElementById('field_name')?.value,
                defaultTnved: document.getElementById('field_tnved')?.value,
                densityDefault: document.getElementById('field_density')?.value
            };
            if (!newItem.name) { alert('Введите наименование продукта'); return; }
            break;
    }
    
    try {
        await addItem(currentCategory, newItem);
        await renderDatabasePanel();
        await populateAllSelects();
        if (modal) modal.style.display = 'none';
        if (statusMsg) {
            statusMsg.innerHTML = `✅ Добавлено в категорию ${getCategoryNameRu(currentCategory)}`;
            setTimeout(() => {
                if (statusMsg.innerHTML.includes('Добавлено')) {
                    statusMsg.innerHTML = '';
                }
            }, 2000);
        }
    } catch (error) {
        if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка: ${error.message}`;
    }
}

function attachEventListeners() {
    if (generateBtn) generateBtn.addEventListener('click', generateXML);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadXML);
    if (copyBtn) copyBtn.addEventListener('click', copyXML);
    
    if (refreshDbBtn) {
        refreshDbBtn.addEventListener('click', async () => { 
            await renderDatabasePanel(); 
            await populateAllSelects(); 
            if (statusMsg) {
                statusMsg.innerHTML = '<i class="fas fa-sync-alt"></i> База данных обновлена';
                setTimeout(() => {
                    if (statusMsg.innerHTML.includes('обновлена')) {
                        statusMsg.innerHTML = '';
                    }
                }, 2000);
            }
        });
    }
    
    if (addEntityBtn) addEntityBtn.addEventListener('click', openAddModal);
    
    const addCompartmentBtn = document.getElementById('addCompartmentBtn');
    if (addCompartmentBtn) {
        addCompartmentBtn.addEventListener('click', () => addCompartment());
    }
    
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', async () => {
            try {
                if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Экспорт данных...';
                await exportAllToFiles();
                if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-download"></i> База данных экспортирована';
                setTimeout(() => {
                    if (statusMsg && statusMsg.innerHTML.includes('экспортирована')) {
                        statusMsg.innerHTML = '';
                    }
                }, 3000);
            } catch (error) {
                if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка экспорта: ${error.message}`;
            }
        });
    }
    
    const importAllBtn = document.getElementById('importAllBtn');
    const importFilesInput = document.createElement('input');
    importFilesInput.type = 'file';
    importFilesInput.multiple = true;
    importFilesInput.accept = '.json';
    importFilesInput.style.display = 'none';
    document.body.appendChild(importFilesInput);
    
    if (importAllBtn) {
        importAllBtn.addEventListener('click', () => {
            importFilesInput.click();
        });
        
        importFilesInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Импорт данных...';
                try {
                    const count = await importAllFromFiles(files);
                    if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-check-circle"></i> Импортировано ${count} файлов`;
                    await renderDatabasePanel();
                    await populateAllSelects();
                } catch (error) {
                    if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка импорта: ${error.message}`;
                }
                setTimeout(() => {
                    if (statusMsg && (statusMsg.innerHTML.includes('Импортировано') || statusMsg.innerHTML.includes('Ошибка'))) {
                        statusMsg.innerHTML = '';
                    }
                }, 3000);
                importFilesInput.value = '';
            }
        });
    }
    
    const clearStorageBtn = document.getElementById('clearStorageBtn');
    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', async () => {
            if (confirm('⚠️ ВНИМАНИЕ! Это действие удалит ВСЕ ваши данные.\n\nВы уверены?')) {
                try {
                    await clearAllDatabase();
                    if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> База данных очищена';
                    await renderDatabasePanel();
                    await populateAllSelects();
                    setTimeout(() => {
                        if (statusMsg && statusMsg.innerHTML.includes('очищена')) {
                            statusMsg.innerHTML = '';
                        }
                    }, 2000);
                } catch (error) {
                    if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка очистки: ${error.message}`;
                }
            }
        });
    }
    
    if (saveEntityBtn) saveEntityBtn.addEventListener('click', saveNewEntity);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    
    window.addEventListener('click', (e) => { 
        if (e.target === modal) modal.style.display = 'none'; 
    });
    
    document.querySelectorAll('.db-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            dbSearchTerm = '';
            await renderDatabasePanel();
        });
    });
}

// Делаем функции глобальными для доступа из HTML
window.addCompartment = addCompartment;
window.removeCompartment = removeCompartment;
