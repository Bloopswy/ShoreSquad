/* ============================================
   ShoreSquad - Main Application JavaScript
   Interactive features, crew management, and weather tracking
   ============================================ */

// ============================================
// CONFIGURATION & STATE MANAGEMENT
// ============================================

const AppConfig = {
    storageKeys: {
        crew: 'shoresquad_crew',
        cleanups: 'shoresquad_cleanups',
        stats: 'shoresquad_stats',
        theme: 'shoresquad_theme'
    },
    api: {
        // NEA Realtime Weather Readings API - Singapore
        neaWeatherReadings: 'https://api.data.gov.sg/v1/environment/air-temperature',
        neaWeatherForecast: 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast',
        neaWeather4Day: 'https://api.data.gov.sg/v1/environment/4-day-weather-forecast',
        // Fallback: Open-Meteo for extended forecasts
        openMeteo: 'https://api.open-meteo.com/v1/forecast'
    }
};

// Application state
const AppState = {
    crew: [],
    cleanups: [],
    stats: {
        cleanups: 0,
        trash: 0,
        beaches: 0,
        crewMembers: 0
    },
    userLocation: null,
    theme: localStorage.getItem(AppConfig.storageKeys.theme) || 'light'
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadStateFromStorage();
    setupTheme();
    setupEventListeners();
    renderUI();
    console.log('🌊 ShoreSquad initialized successfully!');
}

// ============================================
// STORAGE MANAGEMENT
// ============================================

function loadStateFromStorage() {
    try {
        const savedCrew = localStorage.getItem(AppConfig.storageKeys.crew);
        const savedStats = localStorage.getItem(AppConfig.storageKeys.stats);
        
        if (savedCrew) AppState.crew = JSON.parse(savedCrew);
        if (savedStats) AppState.stats = JSON.parse(savedStats);
    } catch (error) {
        console.error('Error loading state from storage:', error);
    }
}

function saveStateToStorage() {
    try {
        localStorage.setItem(AppConfig.storageKeys.crew, JSON.stringify(AppState.crew));
        localStorage.setItem(AppConfig.storageKeys.stats, JSON.stringify(AppState.stats));
    } catch (error) {
        console.error('Error saving state to storage:', error);
    }
}

// ============================================
// THEME MANAGEMENT
// ============================================

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // Initialize theme on page load
    updateThemeDisplay();

    themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const html = document.documentElement;
    const isDark = AppState.theme === 'dark';
    
    AppState.theme = isDark ? 'light' : 'dark';
    localStorage.setItem(AppConfig.storageKeys.theme, AppState.theme);
    
    if (isDark) {
        html.style.colorScheme = 'light';
    } else {
        html.style.colorScheme = 'dark';
    }
    
    updateThemeDisplay();
}

function updateThemeDisplay() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    themeToggle.textContent = AppState.theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', 
        `Switch to ${AppState.theme === 'dark' ? 'light' : 'dark'} mode`
    );
}

// ============================================
// EVENT LISTENER SETUP
// ============================================

function setupEventListeners() {
    // Hero CTA buttons
    const startBtn = document.getElementById('start-btn');
    const learnMoreBtn = document.getElementById('learn-more-btn');
    
    startBtn?.addEventListener('click', scrollToSection('crew'));
    learnMoreBtn?.addEventListener('click', scrollToSection('mission'));

    // Location button
    const locationBtn = document.getElementById('location-btn');
    locationBtn?.addEventListener('click', enableLocation);

    // Crew management
    const addCrewBtn = document.getElementById('add-crew-btn');
    const cancelCrewBtn = document.getElementById('cancel-crew-btn');
    const crewForm = document.getElementById('crew-form');
    
    addCrewBtn?.addEventListener('click', showCrewForm);
    cancelCrewBtn?.addEventListener('click', hideCrewForm);
    crewForm?.addEventListener('submit', handleCrewSubmit);

    // Schedule cleanup button
    const scheduleBtn = document.getElementById('schedule-cleanup-btn');
    scheduleBtn?.addEventListener('click', handleScheduleCleanup);
}

// ============================================
// SCROLL & NAVIGATION
// ============================================

function scrollToSection(sectionId) {
    return () => {
        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: 'smooth' });
    };
}

// ============================================
// LOCATION & WEATHER
// ============================================

function enableLocation() {
    if (!navigator.geolocation) {
        showNotification('Geolocation not supported in your browser', 'error');
        return;
    }

    const locationBtn = document.getElementById('location-btn');
    const originalText = locationBtn.textContent;
    locationBtn.textContent = '📍 Getting location...';
    locationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            AppState.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            updateLocationUI();
            fetchWeatherData();
            showNotification('✓ Location enabled!', 'success');
            
            locationBtn.textContent = originalText;
            locationBtn.disabled = false;
        },
        (error) => {
            console.error('Geolocation error:', error);
            showNotification('Enable location in browser settings', 'error');
            locationBtn.textContent = originalText;
            locationBtn.disabled = false;
        }
    );
}

function updateLocationUI() {
    if (!AppState.userLocation) return;

    const mapPlaceholder = document.querySelector('.map-placeholder');
    if (mapPlaceholder) {
        mapPlaceholder.innerHTML = `
            <p>📍 <strong>Your Location</strong></p>
            <p class="small-text">Lat: ${AppState.userLocation.lat.toFixed(4)}, 
            Lng: ${AppState.userLocation.lng.toFixed(4)}</p>
            <p class="small-text">Accuracy: ${Math.round(AppState.userLocation.accuracy)}m</p>
        `;
    }
}

async function fetchWeatherData() {
    try {
        // Fetch NEA 4-day forecast for Singapore
        const forecastResponse = await fetch(AppConfig.api.neaWeather4Day);
        const forecastData = await forecastResponse.json();
        
        // Fetch current conditions
        const readingsResponse = await fetch(AppConfig.api.neaWeatherReadings);
        const readingsData = await readingsResponse.json();
        
        updateWeatherUI(forecastData, readingsData);
    } catch (error) {
        console.error('NEA Weather API error:', error);
        // Fallback to mock data
        updateWeatherUI(getMockForecastData(), getMockReadingsData());
    }
}

function getMockForecastData() {
    return {
        items: [{
            valid_period: {
                start: new Date().toISOString(),
                end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
            },
            forecasts: [
                {
                    date: getDateString(0),
                    forecast: 'Partly cloudy',
                    relative_humidity: { low: 60, high: 80 }
                },
                {
                    date: getDateString(1),
                    forecast: 'Thundery showers',
                    relative_humidity: { low: 70, high: 90 }
                },
                {
                    date: getDateString(2),
                    forecast: 'Cloudy',
                    relative_humidity: { low: 65, high: 85 }
                },
                {
                    date: getDateString(3),
                    forecast: 'Partly cloudy',
                    relative_humidity: { low: 60, high: 80 }
                }
            ]
        }]
    };
}

function getMockReadingsData() {
    return {
        items: [{
            metadata: {
                stations: [
                    { id: 'S1', name: 'Pasir Ris', location: { lat: 1.3815, lon: 103.9556 } }
                ]
            },
            readings: [{
                station_id: 'S1',
                value: 24
            }]
        }]
    };
}

function getDateString(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
}

function updateWeatherUI(forecastData, readingsData) {
    // Update current weather
    const currentWeatherEl = document.getElementById('current-weather');
    if (currentWeatherEl && readingsData?.items?.[0]?.readings?.[0]) {
        const temp = readingsData.items[0].readings[0].value;
        const humidity = forecastData?.items?.[0]?.forecasts?.[0]?.relative_humidity?.high || 75;
        currentWeatherEl.innerHTML = `
            <p><strong>🌡️ ${temp}°C</strong></p>
            <p class="small-text">Humidity: ${humidity}%</p>
            <p class="small-text">📍 Pasir Ris Station</p>
        `;
    }

    // Update ocean conditions
    const oceanConditionsEl = document.getElementById('ocean-conditions');
    if (oceanConditionsEl && forecastData?.items?.[0]?.forecasts?.[0]) {
        const forecast = forecastData.items[0].forecasts[0];
        const humidity = forecast.relative_humidity;
        oceanConditionsEl.innerHTML = `
            <p><strong>🌊 ${forecast.forecast}</strong></p>
            <p class="small-text">Humidity: ${humidity?.low || 70}-${humidity?.high || 85}%</p>
            <p class="small-text">⚠️ Check tide times locally</p>
        `;
    }

    // Render 4-day forecast
    const bestTimeEl = document.getElementById('best-time');
    if (bestTimeEl) {
        bestTimeEl.innerHTML = '<p><strong>📅 4-Day Forecast</strong></p>';
        bestTimeEl.id = 'forecast-container';
        renderForecastGrid(forecastData);
    }
}

function renderForecastGrid(forecastData) {
    const weatherGrid = document.getElementById('weather-grid');
    if (!weatherGrid || !forecastData?.items?.[0]?.forecasts) return;

    // Create forecast cards
    const forecasts = forecastData.items[0].forecasts;
    const forecastHTML = forecasts.map((day, index) => `
        <div class="weather-card forecast-card">
            <h4>${formatDateForDisplay(day.date)}</h4>
            <div class="weather-content">
                <p><strong>${getForecastEmoji(day.forecast)} ${day.forecast}</strong></p>
                <p class="small-text">
                    Humidity: ${day.relative_humidity?.low || 65}-${day.relative_humidity?.high || 85}%
                </p>
                ${index === 0 ? '<p class="forecast-best">✅ Best for cleanup!</p>' : ''}
            </div>
        </div>
    `).join('');

    // Update weather grid to show only 4-day forecast
    weatherGrid.innerHTML = forecastHTML;
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-SG', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric'
    });
}

function getForecastEmoji(forecastText) {
    const text = forecastText.toLowerCase();
    if (text.includes('thundery') || text.includes('thunder')) return '⛈️';
    if (text.includes('rain') || text.includes('shower')) return '🌧️';
    if (text.includes('cloudy') || text.includes('cloud')) return '☁️';
    if (text.includes('partly cloudy')) return '⛅';
    if (text.includes('clear') || text.includes('sunny')) return '☀️';
    if (text.includes('windy') || text.includes('wind')) return '💨';
    return '🌤️';
}

function getWeatherEmoji(code) {
    // WMO weather code to emoji mapping (for fallback)
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 77) return '🌧️';
    if (code >= 80 && code <= 82) return '⛈️';
    if (code >= 85 && code <= 86) return '❄️';
    return '🌤️';
}

// ============================================
// CREW MANAGEMENT
// ============================================

function showCrewForm() {
    const crewInput = document.getElementById('crew-input');
    crewInput?.classList.remove('hidden');
}

function hideCrewForm() {
    const crewInput = document.getElementById('crew-input');
    const crewForm = document.getElementById('crew-form');
    crewInput?.classList.add('hidden');
    crewForm?.reset();
}

function handleCrewSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const crewMember = {
        id: Date.now(),
        name: formData.get('name'),
        role: formData.get('role'),
        joinedDate: new Date().toLocaleDateString()
    };

    AppState.crew.push(crewMember);
    AppState.stats.crewMembers = AppState.crew.length;
    
    saveStateToStorage();
    renderCrewGrid();
    updateStats();
    hideCrewForm();
    
    showNotification(`✓ ${crewMember.name} added to squad!`, 'success');
}

function renderCrewGrid() {
    const crewGrid = document.getElementById('crew-grid');
    if (!crewGrid) return;

    const crewHTML = AppState.crew.map(member => `
        <div class="crew-card" role="listitem">
            <h3>${member.name}</h3>
            <p class="small-text">${member.role}</p>
            <p class="small-text">Joined: ${member.joinedDate}</p>
            <button class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-md);"
                    onclick="removeCrewMember(${member.id})" aria-label="Remove ${member.name}">
                Remove
            </button>
        </div>
    `).join('');

    const addCrewHTML = `
        <div class="crew-card add-crew-card" role="listitem">
            <button id="add-crew-btn" class="add-crew-btn" aria-label="Add new crew member">
                <span class="plus-icon">+</span>
                <span>Add Member</span>
            </button>
        </div>
    `;

    crewGrid.innerHTML = crewHTML + addCrewHTML;
    
    // Re-attach event listener to new add button
    document.getElementById('add-crew-btn')?.addEventListener('click', showCrewForm);
}

function removeCrewMember(id) {
    AppState.crew = AppState.crew.filter(member => member.id !== id);
    AppState.stats.crewMembers = AppState.crew.length;
    
    saveStateToStorage();
    renderCrewGrid();
    updateStats();
    
    showNotification('✓ Crew member removed', 'success');
}

// ============================================
// MISSION & STATISTICS
// ============================================

function handleScheduleCleanup() {
    const randomItems = Math.floor(Math.random() * 50) + 20;
    
    AppState.stats.cleanups += 1;
    AppState.stats.trash += randomItems;
    AppState.stats.beaches = Math.min(AppState.stats.cleanups, 5);
    
    saveStateToStorage();
    updateStats();
    
    showNotification(`✓ Cleanup scheduled! Expected to remove ~${randomItems} items 🌊`, 'success');
}

function updateStats() {
    document.getElementById('cleanups-count').textContent = AppState.stats.cleanups;
    document.getElementById('trash-count').textContent = AppState.stats.trash;
    document.getElementById('crew-count').textContent = AppState.stats.crewMembers;
    document.getElementById('impact-count').textContent = AppState.stats.beaches;
}

// ============================================
// UI RENDERING
// ============================================

function renderUI() {
    renderCrewGrid();
    updateStats();
}

// ============================================
// UTILITIES & NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.textContent = message;
    
    // Style notification
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background-color: ${type === 'success' ? '#06A77D' : type === 'error' ? '#FF6B6B' : '#0077B6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 2000;
        animation: slideIn 300ms ease-in-out;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    // Auto-remove notification
    setTimeout(() => {
        notification.style.animation = 'slideOut 300ms ease-in-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================

// Debounce utility for performance
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

// Throttle utility for scroll events
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
}

// Lazy loading for images (future enhancement)
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Service Worker registration for offline support (future)
if ('serviceWorker' in navigator) {
    // navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed'));
}

// ============================================
// ACCESSIBILITY HELPERS
// ============================================

// Announce dynamic content changes to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

console.log('✓ ShoreSquad app.js loaded successfully');
