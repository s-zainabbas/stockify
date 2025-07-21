// ========== CONFIGURATION ==========
const API_KEY = 'd1v9ljhr01qqgeekaf70d1v9ljhr01qqgeekaf7g'; // <-- Replace with your Finnhub API key
const BASE_URL = 'https://finnhub.io/api/v1/stock/candle';
const DEFAULT_SYMBOL = 'AAPL';
const WATCHLIST = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];


// ========== DOM ELEMENTS ==========
const stockNameEl = document.getElementById('stock-name');
const stockPriceEl = document.getElementById('stock-price');
const priceChangeEl = document.getElementById('price-change');
const chartCanvas = document.getElementById('stock-chart');
const watchlistEl = document.getElementById('watchlist');
const signalsListEl = document.getElementById('signals-list');
const trendPredictionEl = document.getElementById('trend-prediction');
const alertsListEl = document.getElementById('alerts-list');
const errorMessageEl = document.getElementById('error-message');
const searchInput = document.getElementById('stock-search');
const refreshBtn = document.getElementById('refresh-btn');
const addStockBtn = document.getElementById('add-stock-btn');
const timeBtns = document.querySelectorAll('.time-btn');

let currentSymbol = DEFAULT_SYMBOL;
let currentRange = '1M';
let chartInstance = null;

// ========== UTILS ==========

// Calculate SMA for a given period
function calculateSMA(data, period) {
    let sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += parseFloat(data[i - j].close);
            }
            sma.push(sum / period);
        }
    }
    return sma;
}

// Format date for display
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
}

// Show error message
function showError(msg) {
    errorMessageEl.textContent = msg;
    errorMessageEl.classList.remove('hidden');
}
function hideError() {
    errorMessageEl.classList.add('hidden');
}

// ========== API CALLS ==========

async function fetchStockData(symbol, range) {
    // Map range to resolution and count
    let resolution = 'D';
    let count = 30;
    if (range === '1D') { resolution = '5'; count = 78; }
    else if (range === '1W') { resolution = '15'; count = 26 * 5; }
    else if (range === '1M') { resolution = 'D'; count = 30; }
    else if (range === '3M') { resolution = 'D'; count = 90; }
    else if (range === '1Y') { resolution = 'D'; count = 250; }

    const url = `${BASE_URL}?symbol=${symbol}&resolution=${resolution}&count=${count}&token=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.s !== 'ok') throw new Error(data.error || 'API error');
    // Convert Finnhub format to array of objects
    const values = data.t.map((timestamp, i) => ({
        datetime: new Date(timestamp * 1000).toISOString().split('T')[0],
        close: data.c[i],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        volume: data.v[i]
    }));
    return {
        values: values,
        meta: { name: symbol }
    };
}

async function fetchLatestPrice(symbol) {
    // Use quote endpoint for latest price
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.c) throw new Error('API error');
    return {
        close: data.c,
        percent_change: ((data.c - data.pc) / data.pc) * 100
    };
}

// ========== RENDER FUNCTIONS ==========

function renderChart(data, sma20, sma50, sma200, labels) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Price',
                    data: data.map(d => d.close),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: false,
                },
                {
                    label: '20-day SMA',
                    data: sma20,
                    borderColor: '#a21caf',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: '50-day SMA',
                    data: sma50,
                    borderColor: '#eab308',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: '200-day SMA',
                    data: sma200,
                    borderColor: '#16a34a',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { display: true, title: { display: false } },
                y: { display: true, title: { display: false } }
            }
        }
    });
}

function renderSignals(data, sma20, sma50, sma200) {
    signalsListEl.innerHTML = '';
    const price = parseFloat(data[data.length - 1].close);
    const s20 = sma20[sma20.length - 1];
    const s50 = sma50[sma50.length - 1];
    const s200 = sma200[sma200.length - 1];

    // Bullish Trend
    if (price > s20 && s20 > s50 && s50 > s200) {
        signalsListEl.innerHTML += `
        <div class="signal-bullish p-3 rounded-lg bg-green-50">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-medium">Bullish Trend</h3>
                    <p class="text-sm text-gray-600">Price > 20-day > 50-day > 200-day</p>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Strong</span>
            </div>
        </div>`;
    }
    // Golden Cross
    if (s50 > s200 && sma50[sma50.length - 2] <= sma200[sma200.length - 2]) {
        signalsListEl.innerHTML += `
        <div class="golden-cross p-3 rounded-lg bg-green-50">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-medium">Golden Cross</h3>
                    <p class="text-sm text-gray-600">50-day crossed above 200-day</p>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Bullish</span>
            </div>
        </div>`;
    }
    // Price Above MAs
    if (price > s20 && price > s50 && price > s200) {
        signalsListEl.innerHTML += `
        <div class="p-3 rounded-lg bg-blue-50">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-medium">Price Above MAs</h3>
                    <p class="text-sm text-gray-600">Price is above all key moving averages</p>
                </div>
                <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Positive</span>
            </div>
        </div>`;
    }
    if (!signalsListEl.innerHTML) {
        signalsListEl.innerHTML = `<div class="p-3 rounded-lg bg-yellow-50">
            <h3 class="font-medium">No strong signals detected.</h3>
        </div>`;
    }
}

function renderPrediction(data, sma20, sma50, sma200) {
    // Simple prediction: if price > all SMAs, bullish; else neutral
    const price = parseFloat(data[data.length - 1].close);
    const s20 = sma20[sma20.length - 1];
    const s50 = sma50[sma50.length - 1];
    const s200 = sma200[sma200.length - 1];
    let outlook = '';
    let percent = '+0.0%';
    let color = 'green';

    if (price > s20 && s20 > s50 && s50 > s200) {
        outlook = 'Bullish Outlook';
        percent = '+3.5%';
        color = 'green';
    } else if (price < s20 && s20 < s50 && s50 < s200) {
        outlook = 'Bearish Outlook';
        percent = '-3.5%';
        color = 'red';
    } else {
        outlook = 'Neutral';
        percent = '+0.0%';
        color = 'gray';
    }

    trendPredictionEl.innerHTML = `
        <div class="signal-bullish p-4 rounded-lg">
            <div class="flex items-start gap-3">
                <div class="mt-1">
                    <svg class="h-6 w-6 text-${color}-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                    </svg>
                </div>
                <div>
                    <h3 class="font-medium">${outlook}</h3>
                    <p class="text-sm text-gray-600 mt-1">This is a simple trend prediction based on moving averages.</p>
                </div>
            </div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="p-2 bg-${color}-50 rounded">
                <p class="text-xs text-gray-500">Next Day</p>
                <p class="font-medium text-${color}-600">${percent}</p>
            </div>
            <div class="p-2 bg-${color}-50 rounded">
                <p class="text-xs text-gray-500">3-Day</p>
                <p class="font-medium text-${color}-600">${percent}</p>
            </div>
            <div class="p-2 bg-${color}-50 rounded">
                <p class="text-xs text-gray-500">5-Day</p>
                <p class="font-medium text-${color}-600">${percent}</p>
            </div>
        </div>
    `;
}

function renderWatchlist() {
    watchlistEl.innerHTML = '';
    WATCHLIST.forEach(symbol => {
        watchlistEl.innerHTML += `
        <div class="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center" data-symbol="${symbol}">
            <div>
                <h3 class="font-medium">${symbol}</h3>
                <p class="text-sm text-gray-600" id="name-${symbol}"></p>
            </div>
            <div class="text-right">
                <p class="font-medium" id="price-${symbol}">$0.00</p>
                <p class="text-sm" id="change-${symbol}">0.00%</p>
            </div>
        </div>`;
    });
    // Add click listeners
    document.querySelectorAll('#watchlist [data-symbol]').forEach(el => {
        el.addEventListener('click', () => {
            currentSymbol = el.getAttribute('data-symbol');
            updateDashboard();
        });
    });
}

async function updateWatchlistPrices() {
    for (const symbol of WATCHLIST) {
        try {
            const latest = await fetchLatestPrice(symbol);
            document.getElementById(`price-${symbol}`).textContent = `$${parseFloat(latest.close).toFixed(2)}`;
            document.getElementById(`change-${symbol}`).textContent = `${parseFloat(latest.percent_change).toFixed(2)}%`;
            document.getElementById(`change-${symbol}`).className = 'text-sm ' + (latest.percent_change >= 0 ? 'price-up' : 'price-down');
            document.getElementById(`name-${symbol}`).textContent = symbol; // You can fetch company name if needed
        } catch (e) {
            document.getElementById(`price-${symbol}`).textContent = 'N/A';
            document.getElementById(`change-${symbol}`).textContent = '';
        }
    }
}

function renderAlerts(data, sma20, sma50, sma200) {
    alertsListEl.innerHTML = '';
    // Golden Cross
    if (sma50[sma50.length - 1] > sma200[sma200.length - 1] && sma50[sma50.length - 2] <= sma200[sma200.length - 2]) {
        alertsListEl.innerHTML += `
        <div class="p-4">
            <div class="flex items-start gap-3">
                <div class="mt-1">
                    <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <h3 class="font-medium">Golden Cross Detected</h3>
                    <p class="text-sm text-gray-600 mt-1">${currentSymbol}'s 50-day moving average crossed above the 200-day moving average.</p>
                    <p class="text-xs text-gray-400 mt-2">${formatDate(data[data.length - 1].datetime)}</p>
                </div>
            </div>
        </div>`;
    }
    // Price Crossed Above 20-day SMA
    if (parseFloat(data[data.length - 1].close) > sma20[sma20.length - 1] && parseFloat(data[data.length - 2].close) <= sma20[sma20.length - 2]) {
        alertsListEl.innerHTML += `
        <div class="p-4">
            <div class="flex items-start gap-3">
                <div class="mt-1">
                    <div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <h3 class="font-medium">Price Crossed Above 20-day SMA</h3>
                    <p class="text-sm text-gray-600 mt-1">${currentSymbol}'s price crossed above its 20-day moving average.</p>
                    <p class="text-xs text-gray-400 mt-2">${formatDate(data[data.length - 1].datetime)}</p>
                </div>
            </div>
        </div>`;
    }
    if (!alertsListEl.innerHTML) {
        alertsListEl.innerHTML = `<div class="p-4"><h3 class="font-medium">No recent alerts.</h3></div>`;
    }
}

// ========== MAIN DASHBOARD UPDATE ==========

async function updateDashboard() {
    hideError();
    try {
        // Fetch data
        const stockData = await fetchStockData(currentSymbol, currentRange);
        const data = stockData.values.reverse(); // Oldest to newest
        // Calculate SMAs
        const sma20 = calculateSMA(data, 20);
        const sma50 = calculateSMA(data, 50);
        const sma200 = calculateSMA(data, 200);
        // Update chart
        renderChart(data, sma20, sma50, sma200, data.map(d => d.datetime));
        // Update name and price
        stockNameEl.textContent = `${stockData.meta.name} (${currentSymbol})`;
        stockPriceEl.textContent = `$${parseFloat(data[data.length - 1].close).toFixed(2)}`;
        // Calculate price change
        const prevClose = parseFloat(data[data.length - 2].close);
        const lastClose = parseFloat(data[data.length - 1].close);
        const change = lastClose - prevClose;
        const percent = (change / prevClose) * 100;
        priceChangeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;
        priceChangeEl.className = (change >= 0 ? 'price-up' : 'price-down') + ' text-sm font-medium px-2 py-1 rounded';
        // Update signals, prediction, alerts
        renderSignals(data, sma20, sma50, sma200);
        renderPrediction(data, sma20, sma50, sma200);
        renderAlerts(data, sma20, sma50, sma200);
        // Update watchlist prices
        updateWatchlistPrices();
    } catch (e) {
        showError(e.message);
    }
}

// ========== EVENT LISTENERS ==========

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        currentSymbol = searchInput.value.trim().toUpperCase();
        updateDashboard();
    }
});
refreshBtn.addEventListener('click', updateDashboard);
addStockBtn.addEventListener('click', () => {
    const symbol = prompt('Enter stock symbol (e.g. AAPL):');
    if (symbol && !WATCHLIST.includes(symbol.toUpperCase())) {
        WATCHLIST.push(symbol.toUpperCase());
        renderWatchlist();
        updateWatchlistPrices();
    }
});
timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('bg-blue-100', 'text-blue-700', 'font-medium'));
        btn.classList.add('bg-blue-100', 'text-blue-700', 'font-medium');
        currentRange = btn.getAttribute('data-range');
        updateDashboard();
    });
});

// ========== INIT ==========
renderWatchlist();
updateDashboard();

