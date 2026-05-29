// app.js - основная логика приложения с IndexedDB и поддержкой нескольких отсеков

// Глобальные переменные
let currentCategory = 'shippers';
let currentEditId = null;
let dbSearchTerm = '';
let compartments = []; // Массив для хранения отсеков
// Получение текущего пользователя
let currentUser = null;

function loadCurrentUser() {
    const userData = sessionStorage.getItem('etrn_user');
    if (userData) {
        try {
            currentUser = JSON.parse(userData);
            displayUserInfo();
        } catch(e) {
            console.error('Ошибка загрузки пользователя', e);
        }
    }
}

function displayUserInfo() {
    if (!currentUser) return;
    
    const userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';
    userInfoDiv.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <span>${currentUser.displayName || currentUser.login}</span>
        ${currentUser.role === 'demo' ? '<span class="demo-badge">ДЕМО</span>' : ''}
        <button class="logout-btn" id="logoutBtn" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
    `;
    
    const header = document.querySelector('.glass-header');
    const existingUserInfo = header.querySelector('.user-info');
    if (existingUserInfo) existingUserInfo.remove();
    
    const headerActions = header.querySelector('.header-actions');
    if (headerActions) {
        headerActions.insertBefore(userInfoDiv, headerActions.firstChild);
    } else {
        header.appendChild(userInfoDiv);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('etrn_user');
            window.location.href = 'index.html';
        });
    }
    
    // Если демо-режим, показываем лимиты в интерфейсе
    if (currentUser.role === 'demo') {
        showDemoLimits();
    }
}

function showDemoLimits() {
    const statusMsgDiv = document.getElementById('statusMsg');
    if (statusMsgDiv) {
        const demoWarning = document.createElement('div');
        demoWarning.className = 'demo-warning';
        demoWarning.innerHTML = `
            <i class="fas fa-info-circle"></i>
            ДЕМО-РЕЖИМ: не более 5 записей в каждой категории. 
            Для полной версии войдите под своим логином.
        `;
        const dbPanel = document.querySelector('.db-panel');
        if (dbPanel && !dbPanel.querySelector('.demo-warning')) {
            dbPanel.insertBefore(demoWarning, dbPanel.querySelector('.db-tabs'));
        }
    }
}

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    // ... остальной код инициализации
});
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

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Загрузка базы данных...';
    
    await initDatabase();
    createSearchInputs();
    await populateAllSelects();
    await renderDatabasePanel();
    attachEventListeners();
    initCompartments();
    
    // Установка даты по умолчанию
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('shipmentDate').value = today;
    
    statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> База данных IndexedDB готова';
    setTimeout(() => {
        if (statusMsg.innerHTML.includes('готова')) {
            statusMsg.innerHTML = '';
        }
    }, 2000);
});

// Инициализация отсеков
function initCompartments() {
    // Добавляем один отсек по умолчанию
    addCompartment();
}
// Кнопка возврата на главную
const backBtn = document.getElementById('backToLandingBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}
// Добавление нового отсека
function addCompartment() {
    const container = document.getElementById('compartmentsContainer');
    const compartmentId = Date.now();
    
    const compartmentDiv = document.createElement('div');
    compartmentDiv.className = 'compartment-card';
    compartmentDiv.dataset.id = compartmentId;
    
    compartmentDiv.innerHTML = `
        <div class="compartment-header">
            <span class="compartment-title">Отсек ${compartments.length + 1}</span>
            <button type="button" class="remove-compartment-btn" onclick="removeCompartment(${compartmentId})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label><i class="fas fa-oil-can"></i> Продукт</label>
                <div class="product-search-container" data-compartment="${compartmentId}">
                    <input type="text" id="productInput_${compartmentId}" class="glass-input product-search-input" placeholder="-- Введите для поиска --" autocomplete="off">
                </div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-barcode"></i> Код ТН ВЭД</label>
                <input type="text" id="tnvedCode_${compartmentId}" class="glass-input tnved-input" placeholder="Определяется из продукта" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label><i class="fas fa-weight-hanging"></i> Масса брутто (тонн)</label>
                <input type="number" step="0.001" id="weight_${compartmentId}" class="glass-input weight-input" placeholder="12.000">
            </div>
            <div class="form-group">
                <label><i class="fas fa-cubes"></i> Количество мест</label>
                <input type="number" step="1" id="places_${compartmentId}" class="glass-input places-input" placeholder="1" value="1">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label><i class="fas fa-chart-line"></i> Плотность (кг/м³)</label>
                <input type="text" id="density_${compartmentId}" class="glass-input density-input" placeholder="0.845">
            </div>
            <div class="form-group">
                <label><i class="fas fa-thermometer-half"></i> Температура (°C)</label>
                <input type="text" id="temp_${compartmentId}" class="glass-input temp-input" placeholder="18.5">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group full-width">
                <label><i class="fas fa-tag"></i> Маркировка/описание</label>
                <input type="text" id="marking_${compartmentId}" class="glass-input marking-input" placeholder="Отсутствует">
            </div>
        </div>
    `;
    
    container.appendChild(compartmentDiv);
    
    // Сохраняем данные отсека
    compartments.push({
        id: compartmentId,
        product: null,
        tnved: '',
        weight: '',
        places: 1,
        density: '0.845',
        temp: '18.5',
        marking: 'Отсутствует'
    });
    
    // Настраиваем поиск продукта для этого отсека
    setupProductSearchForCompartment(compartmentId);
    
    // Обновляем заголовки отсеков
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
            
            // Заполняем ТН ВЭД
            const tnvedInput = document.getElementById(`tnvedCode_${compartmentId}`);
            if (tnvedInput && product.defaultTnved) {
                tnvedInput.value = product.defaultTnved;
                compartment.tnved = product.defaultTnved;
            }
            
            // Заполняем плотность по умолчанию
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
    
    // Сохраняем изменения при вводе
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
    
    const markingInput = document.getElementById(`marking_${compartmentId}`);
    if (markingInput) {
        markingInput.oninput = function() {
            const compartment = compartments.find(c => c.id === compartmentId);
            if (compartment) compartment.marking = this.value || 'Отсутствует';
        };
    }
}

// Удаление отсека
function removeCompartment(id) {
    if (compartments.length <= 1) {
        statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Должен быть хотя бы один отсек';
        setTimeout(() => {
            if (statusMsg.innerHTML.includes('хотя бы один')) {
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
        const title = card.querySelector('.compartment-title');
        if (title) {
            title.textContent = `Отсек ${idx + 1}`;
        }
    });
}

// Создание input полей с поиском
function createSearchInputs() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles'];
    
    categories.forEach(category => {
        const container = document.getElementById(`${category}Container`);
        if (container) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `${category}Input`;
            input.className = 'glass-input';
            input.placeholder = '-- Введите для поиска --';
            input.autocomplete = 'off';
            input.setAttribute('data-category', category);
            container.appendChild(input);
            inputs[category] = input;
            selectedItems[category] = null;
        }
    });
}

// Заполнение всех выпадающих списков
async function populateAllSelects() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles'];
    
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
                case 'vehicles': displayText = `${item.regNumber} (${item.brand || item.nationality})`; break;
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
                    this.setAttribute('data-selected', JSON.stringify(selectedItems[category]));
                } else {
                    selectedItems[category] = null;
                    this.removeAttribute('data-selected');
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
        
        if (items.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state">📭 Нет записей. Нажмите "Добавить"</div>';
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
                        statusMsg.innerHTML = `✅ Запись удалена из категории ${getCategoryNameRu(category)}`;
                        await renderDatabasePanel();
                        await populateAllSelects();
                        setTimeout(() => {
                            if (statusMsg.innerHTML.includes('удалена')) {
                                statusMsg.innerHTML = '';
                            }
                        }, 2000);
                    } catch (error) {
                        statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка удаления: ${error.message}`;
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
                statusMsg.innerHTML = `📋 Данные из ${getCategoryNameRu(category)} загружены в форму`;
                setTimeout(() => {
                    if (statusMsg.innerHTML.includes('загружены')) {
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
        case 'shippers': return `ИНН: ${item.inn}`;
        case 'consignees': return `ИНН: ${item.inn}`;
        case 'carriers': return `ИНН: ${item.inn}`;
        case 'drivers': return `уд. ${item.license}`;
        case 'signers': return item.position;
        case 'vehicles': return item.brand || item.nationality;
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
        case 'vehicles': displayText = `${data.regNumber} (${data.brand || data.nationality})`; break;
    }
    
    inputs[category].value = displayText;
    selectedItems[category] = data;
    inputs[category].setAttribute('data-selected', JSON.stringify(data));
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

// Форматирование времени
function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// Генерация GUID
function generateGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }).toUpperCase();
}

// Генерация XML по новому образцу (исправленная кодировка)
function generateXML() {
    try {
        const shipper = getSelectedFromSearch('shippers');
        const consignee = getSelectedFromSearch('consignees');
        const carrier = getSelectedFromSearch('carriers');
        const driver = getSelectedFromSearch('drivers');
        const signer = getSelectedFromSearch('signers');
        const vehicle = getSelectedFromSearch('vehicles');
        
        // Получаем основные данные формы
        const ttnNumber = document.getElementById('ttnNumber').value.trim() || `21323`;
        const contractNumber = document.getElementById('contractNumber').value.trim() || 'Без номера';
        const contractDate = document.getElementById('contractDate').value;
        const shipmentDate = document.getElementById('shipmentDate').value;
        const arrivalTime = document.getElementById('arrivalTime').value || getCurrentTime();
        const departureTime = document.getElementById('departureTime').value || getCurrentTime();
        const addressIndex = document.getElementById('addressIndex').value || '109472';
        const addressRegion = document.getElementById('addressRegion').value || '77';
        const addressStreet = document.getElementById('addressStreet').value || 'ВОЛГОГРАДСКИЙ ПР-КТ';
        const addressHouse = document.getElementById('addressHouse').value || '164';
        const addressBuilding = document.getElementById('addressBuilding').value || 'К3';
        const deliveryAddressIndex = document.getElementById('deliveryAddressIndex').value || '420111';
        const deliveryAddressRegion = document.getElementById('deliveryAddressRegion').value || '03';
        const loadMethod = document.getElementById('loadMethod').value || '01';
        const cargoCondition = document.getElementById('cargoCondition').value || 'Без нареканий';
        const cargoValue = document.getElementById('cargoValue').value || '0';
        
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
                temp: comp.temp || '18.5',
                marking: comp.marking || 'Отсутствует'
            });
        }
        
        if (compartmentsData.length === 0) {
            throw new Error("Добавьте хотя бы один отсек с грузом");
        }
        
        // Форматирование дат
        const formattedShipmentDate = formatDateForXML(shipmentDate);
        const formattedContractDate = contractDate ? formatDateForXML(contractDate) : '';
        const nowDate = new Date().toISOString().slice(0, 10).split('-').reverse().join('.');
        const nowTime = getCurrentTime();
        
        // Генерация ID файла
        const fileId = `ON_TRNACLGROT_${generateGuid()}_${generateGuid()}_0_${nowDate.replace(/\./g, '')}_${generateGuid()}`;
        
        // Построение XML - ИСПРАВЛЕННАЯ ВЕРСИЯ без русских букв в тегах
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<File IdFile="${escapeXml(fileId)}" VersProg="ЭТРН.ONLINE V 1.01" VersForm="5.01">\n`;
        xml += `    <Document KND="1110339" PoFactXJ="Транспортная накладная, информация грузоотправителя" DatInfoGO="${nowDate}" VrInfoGO="${nowTime}">\n`;
        xml += `        <SodInfoGO SodOper="Лицом, осуществляющим погрузку груза, при указанных обстоятельствах передан водителю груз с указанными характеристиками" NomberTrN="${escapeXml(ttnNumber)}" DataTrN="${formattedShipmentDate}" NomZak="${escapeXml(contractNumber)}" DataZak="${formattedContractDate}">\n`;
        xml += `            <SvGO GOExp="0">\n`;
        xml += `                <RekIdentGO>\n`;
        xml += `                    <IdSv>\n`;
        xml += `                        <SvYLUch NamOrg="${escapeXml(shipper.name)}" INNYL="${escapeXml(shipper.inn || '')}" KPP="${escapeXml(shipper.kpp || '')}" />\n`;
        xml += `                    </IdSv>\n`;
        xml += `                    <Address>\n`;
        xml += `                        <AdrRF Index="${escapeXml(addressIndex)}" CodeRegion="${escapeXml(addressRegion)}" />\n`;
        xml += `                    </Address>\n`;
        xml += `                    <Contact>\n`;
        xml += `                        <Tlf>${escapeXml(shipper.phone || '')}</Tlf>\n`;
        xml += `                    </Contact>\n`;
        xml += `                </RekIdentGO>\n`;
        xml += `            </SvGO>\n`;
        xml += `            <SvGP>\n`;
        xml += `                <RekIdentGP>\n`;
        xml += `                    <IdSv>\n`;
        xml += `                        <SvYLUch NamOrg="${escapeXml(consignee.name)}" INNYL="${escapeXml(consignee.inn || '')}" KPP="${escapeXml(consignee.kpp || '')}" />\n`;
        xml += `                    </IdSv>\n`;
        xml += `                    <Contact>\n`;
        xml += `                        <Tlf>${escapeXml(consignee.phone || '')}</Tlf>\n`;
        xml += `                    </Contact>\n`;
        xml += `                </RekIdentGP>\n`;
        xml += `                <AddressDostGr>\n`;
        xml += `                    <AddressRF Index="${escapeXml(deliveryAddressIndex)}" CodeRegion="${escapeXml(deliveryAddressRegion)}" />\n`;
        xml += `                </AddressDostGr>\n`;
        xml += `            </SvGP>\n`;
        
        // Добавляем информацию по каждому отсеку
        for (let i = 0; i < compartmentsData.length; i++) {
            const cargo = compartmentsData[i];
            xml += `            <SvGruz>\n`;
            xml += `                <OpGruz NamGruz="${escapeXml(cargo.productName)}" SostGruz="${escapeXml(cargoCondition)}" SpUpak="0" VidTar="1D" KolMestGr="${cargo.places}">\n`;
            xml += `                    <Mark>${escapeXml(cargo.marking)}</Mark>\n`;
            xml += `                    <PlMasGruz MasBrutZnach="${cargo.weight}" />\n`;
            xml += `                    <CennGruz StCennGr="${escapeXml(cargoValue)}" CodeOKV="643" NamOKV="Российский рубль" />\n`;
            xml += `                </OpGruz>\n`;
            xml += `                <ObCennGr StCennGr="${escapeXml(cargoValue)}" CodeOKV="643" NamOKV="Российский рубль" />\n`;
            
            // Добавляем физико-химические показатели
            if (cargo.density || cargo.temp) {
                xml += `                <FizHimPok>\n`;
                xml += `                    <Pokaz><NamPokaz>Плотность при 15°C</NamPokaz><ZnachPokaz>${cargo.density}</ZnachPokaz><EdPokaz>кг/м³</EdPokaz></Pokaz>\n`;
                xml += `                    <Pokaz><NamPokaz>Температура налива</NamPokaz><ZnachPokaz>${cargo.temp}</ZnachPokaz><EdPokaz>°C</EdPokaz></Pokaz>\n`;
                xml += `                </FizHimPok>\n`;
            }
            
            xml += `            </SvGruz>\n`;
        }
        
        xml += `            <UkazGO UkNormPrvz="Отсутствуют">\n`;
        xml += `                <SvPA LicoPA="Грузоотправитель" SposPerUkPA="Электронное уведомление перевозчика о переадресовке">\n`;
        xml += `                    <KontPA>\n`;
        xml += `                        <Tlf>${escapeXml(shipper.phone || '')}</Tlf>\n`;
        xml += `                    </KontPA>\n`;
        xml += `                </SvPA>\n`;
        xml += `            </UkazGO>\n`;
        xml += `            <SvPer>\n`;
        xml += `                <IdSv>\n`;
        xml += `                    <SvYLUch NamOrg="${escapeXml(carrier.name)}" INNYL="${escapeXml(carrier.inn || '')}" KPP="${escapeXml(carrier.kpp || '')}" />\n`;
        xml += `                </IdSv>\n`;
        xml += `                <Address>\n`;
        xml += `                    <AdrRF Index="${escapeXml(addressIndex)}" CodeRegion="${escapeXml(addressRegion)}" />\n`;
        xml += `                </Address>\n`;
        xml += `                <Contact>\n`;
        xml += `                    <Tlf>${escapeXml(carrier.phone || '')}</Tlf>\n`;
        xml += `                </Contact>\n`;
        xml += `            </SvPer>\n`;
        xml += `            <SvVodit INNFL="${escapeXml(driver.inn || '')}">\n`;
        xml += `                <Tlf>${escapeXml(driver.phone || '')}</Tlf>\n`;
        
        // Разбиваем ФИО водителя
        const driverNameParts = (driver.fullName || '').split(' ');
        const driverLastName = driverNameParts[0] || '';
        const driverFirstName = driverNameParts[1] || '';
        
        xml += `                <FIO Familiya="${escapeXml(driverLastName)}" Imya="${escapeXml(driverFirstName)}" />\n`;
        xml += `            </SvVodit>\n`;
        xml += `            <SvTS>\n`;
        xml += `                <TS RegNumber="${escapeXml(vehicle.regNumber || '')}" TipVlad="1">\n`;
        xml += `                    <ParTS Tip="${escapeXml(vehicle.brand || '')}" Marka="${escapeXml(vehicle.brand || '')}" Gruzopod="${escapeXml(vehicle.loadCapacity || '0')}" Vmestim="${escapeXml(vehicle.capacity || '0')}" />\n`;
        xml += `                </TS>\n`;
        xml += `            </SvTS>\n`;
        xml += `            <SvPogruz ZayavPogr="${shipmentDate}T${arrivalTime}+03:00" NalKoorTochVrZayav="0" FDatVrPrib="${shipmentDate}T${arrivalTime}+03:00" NalKoorTochVrFPogr="0" FDatVrUbyt="${shipmentDate}T${departureTime}+03:00" NalKoorTochVrFUbyt="0" MasBrutOtrg="${totalWeight.toFixed(3)}" MetOpMass="${escapeXml(loadMethod)}" KolMestPriem="${totalPlaces}">\n`;
        xml += `                <FAdresPogr>\n`;
        xml += `                    <AddressRF Index="${escapeXml(addressIndex)}" CodeRegion="${escapeXml(addressRegion)}" Ulitsa="${escapeXml(addressStreet)}" Dom="${escapeXml(addressHouse)}" Korpus="${escapeXml(addressBuilding)}" />\n`;
        xml += `                </FAdresPogr>\n`;
        xml += `                <SvLicPogrGr SovpGOP="1">\n`;
        xml += `                    <IdentRekGO>\n`;
        xml += `                        <INNYL>${escapeXml(shipper.inn || '')}</INNYL>\n`;
        xml += `                    </IdentRekGO>\n`;
        xml += `                </SvLicPogrGr>\n`;
        xml += `                <VladInfra SovpGOV="3" ObNetInfOVlad="Нет данных" />\n`;
        xml += `            </SvPogruz>\n`;
        xml += `        </SodInfoGO>\n`;
        xml += `        <Podpisant StatPod="1">\n`;
        
        // Разбиваем ФИО подписанта
        const signerNameParts = (signer.fio || '').split(' ');
        const signerLastName = signerNameParts[0] || '';
        const signerFirstName = signerNameParts[1] || '';
        const signerPatronymic = signerNameParts[2] || '';
        
        xml += `            <FIO Familiya="${escapeXml(signerLastName)}" Imya="${escapeXml(signerFirstName)}" Otchestvo="${escapeXml(signerPatronymic)}" />\n`;
        xml += `        </Podpisant>\n`;
        xml += `    </Document>\n`;
        xml += `</File>`;
        
        // Отображаем XML в preview
        xmlPreview.innerText = xml;
        statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> XML успешно сформирован по новому формату (UTF-8)';
        return xml;
    } catch(e) {
        statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка: ${e.message}`;
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
        // Используем UTF-8 с BOM для корректного отображения в Windows
        const blob = new Blob(["\uFEFF" + xml], {type: 'application/xml;charset=UTF-8'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `ON_TRNACLGROT_${document.getElementById('ttnNumber').value || 'document'}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        statusMsg.innerHTML = '<i class="fas fa-download"></i> Файл скачан (UTF-8 с BOM)';
    }
}

function copyXML() {
    const xml = xmlPreview.innerText;
    if (xml && !xml.includes('Заполните данные')) {
        navigator.clipboard.writeText(xml);
        statusMsg.innerHTML = '<i class="fas fa-copy"></i> XML скопирован в буфер';
    } else {
        statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Сначала сгенерируйте XML';
    }
}

// Modal handlers for adding entities
function openAddModal() {
    currentEditId = null;
    modalTitle.innerText = `Добавить запись в категорию: ${getCategoryNameRu(currentCategory)}`;
    
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
    modalFields.innerHTML = fieldsHtml;
    modal.style.display = 'flex';
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
        modal.style.display = 'none';
        statusMsg.innerHTML = `✅ Добавлено в категорию ${getCategoryNameRu(currentCategory)}`;
        setTimeout(() => {
            if (statusMsg.innerHTML.includes('Добавлено')) {
                statusMsg.innerHTML = '';
            }
        }, 2000);
    } catch (error) {
        statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка: ${error.message}`;
    }
}

function attachEventListeners() {
    generateBtn.addEventListener('click', generateXML);
    downloadBtn.addEventListener('click', downloadXML);
    copyBtn.addEventListener('click', copyXML);
    
    refreshDbBtn.addEventListener('click', async () => { 
        await renderDatabasePanel(); 
        await populateAllSelects(); 
        statusMsg.innerHTML = '<i class="fas fa-sync-alt"></i> База данных обновлена';
        setTimeout(() => {
            if (statusMsg.innerHTML.includes('обновлена')) {
                statusMsg.innerHTML = '';
            }
        }, 2000);
    });
    
    addEntityBtn.addEventListener('click', openAddModal);
    
    // Кнопка добавления отсека
    const addCompartmentBtn = document.getElementById('addCompartmentBtn');
    if (addCompartmentBtn) {
        addCompartmentBtn.addEventListener('click', () => addCompartment());
    }
    
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', async () => {
            try {
                statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Экспорт данных...';
                await exportAllToFiles();
                statusMsg.innerHTML = '<i class="fas fa-download"></i> База данных экспортирована';
                setTimeout(() => {
                    if (statusMsg.innerHTML.includes('экспортирована')) {
                        statusMsg.innerHTML = '';
                    }
                }, 3000);
            } catch (error) {
                statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка экспорта: ${error.message}`;
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
                statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Импорт данных...';
                try {
                    const count = await importAllFromFiles(files);
                    statusMsg.innerHTML = `<i class="fas fa-check-circle"></i> Импортировано ${count} файлов`;
                    await renderDatabasePanel();
                    await populateAllSelects();
                } catch (error) {
                    statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка импорта: ${error.message}`;
                }
                setTimeout(() => {
                    if (statusMsg.innerHTML.includes('Импортировано') || statusMsg.innerHTML.includes('Ошибка')) {
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
                    statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> База данных очищена';
                    await renderDatabasePanel();
                    await populateAllSelects();
                    setTimeout(() => {
                        if (statusMsg.innerHTML.includes('очищена')) {
                            statusMsg.innerHTML = '';
                        }
                    }, 2000);
                } catch (error) {
                    statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка очистки: ${error.message}`;
                }
            }
        });
    }
    
    saveEntityBtn.addEventListener('click', saveNewEntity);
    cancelModalBtn.addEventListener('click', () => modal.style.display = 'none');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    }
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
    
    // Автоматический расчет объема (опционально)
    const calculateVolume = () => {
        // Можно добавить автоматический расчет при необходимости
    };
}

// Делаем функции глобальными для доступа из HTML
window.addCompartment = addCompartment;
window.removeCompartment = removeCompartment;