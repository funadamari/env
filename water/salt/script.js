// グローバル変数
let parsedData;
let chart;
const allLocations = ["St.2 表層", "St.2 低層", "St.4 表層", "St.4 低層", "オイルフェンス 表層", "オイルフェンス 低層"];
const allYears = [2021, 2022, 2023, 2024, 2025];
// 表示モードの定義
const DISPLAY_MODES = {
    MONTHLY: 'monthly', // 1月から12月の月別表示（デフォルト）
    TIMELINE: 'timeline' // 時系列表示
};
let currentDisplayMode = DISPLAY_MODES.MONTHLY; // 初期表示モード

// 色の設定
const colorScheme = {
    "St.2 表層": { base: 'rgb(0, 0, 100)', dash: [] },
    "St.2 低層": { base: 'rgb(0, 0, 100)', dash: [5, 5] },
    "St.4 表層": { base: 'rgb(0, 100, 255)', dash: [] },
    "St.4 低層": { base: 'rgb(0, 100, 255)', dash: [5, 5] },
    "オイルフェンス 表層": { base: 'rgb(255, 0, 0)', dash: [] },
    "オイルフェンス 低層": { base: 'rgb(255, 0, 0)', dash: [5, 5] }
};

// 年ごとの色の濃度調整
const yearOpacity = {
    2021: 0.6,
    2022: 0.7,
    2023: 0.8,
    2024: 0.9,
    2025: 1
};

// CSVファイルの読み込み
async function loadCSVData() {
    try {
        const response = await fetch('data.csv');
        const csvData = await response.text();
        return parseCSVData(csvData);
    } catch (error) {
        console.error('CSVファイルの読み込みに失敗しました:', error);
        return [];
    }
}

// CSVデータのパース
function parseCSVData(csvData) {
    const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });

    return results.data.map(row => {
        // 年月を解析して年と月を抽出
        const dateParts = row['年月'].split('/');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);

        return {
            year: year,
            month: month,
            yearMonth: `${year}/${month.toString().padStart(2, '0')}`,
            ...row
        };
    });
}

// データセットの作成（月別表示モード用）
function createMonthlyDatasets() {
    const datasets = [];
    const selectedLocations = getSelectedLocations();
    const selectedYears = getSelectedYears();

    // 選択された地点と年について、データセットを作成
    selectedLocations.forEach(location => {
        selectedYears.forEach(year => {
            const yearData = parsedData.filter(row => row.year === year);

            // 月ごとのデータ
            const monthlyData = Array(12).fill(null);
            yearData.forEach(row => {
                if (row[location] !== null && row[location] !== undefined && row[location] !== '') {
                    monthlyData[row.month - 1] = row[location];
                }
            });

            // データがある場合のみデータセットを追加
            if (monthlyData.some(value => value !== null)) {
                const color = colorScheme[location].base;
                const opacity = yearOpacity[year];
                const dataset = {
                    label: `${location} (${year})`,
                    data: monthlyData,
                    borderColor: color.replace('rgb', 'rgba').replace(')', `, ${opacity})`),
                    backgroundColor: 'transparent',
                    borderWidth: Math.min(3, 1 + (year - 2021) * 0.5), // 年が新しいほど線を太く
                    borderDash: colorScheme[location].dash,
                    tension: 0, // 0にすることで直線になります
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: false,
                    spanGaps: false // nullの箇所で線を繋がない
                };
                datasets.push(dataset);
            }
        });
    });

    return datasets;
}

// データセットの作成（時系列表示モード用）
function createTimelineDatasets() {
    const datasets = [];
    const selectedLocations = getSelectedLocations();
    const selectedYears = getSelectedYears();
    
    // 全期間の年月を取得（データ全体から、選択された年に関係なく）
    let allYearMonths = [];
    parsedData.forEach(row => {
        const yearMonth = `${row.year}/${row.month.toString().padStart(2, '0')}`;
        if (!allYearMonths.includes(yearMonth)) {
            allYearMonths.push(yearMonth);
        }
    });
    
    // 時系列順にソート
    allYearMonths.sort();
    
    // 選択された地点ごとにデータセットを作成
    selectedLocations.forEach(location => {
        // 選択された年のデータのみフィルタリング
        const filteredData = parsedData.filter(row => selectedYears.includes(row.year));
        
        // 実際にデータが存在する年月と値のペアを作成
        const dataPoints = [];
        
        filteredData.forEach(row => {
            if (row[location] !== null && row[location] !== undefined && row[location] !== '') {
                dataPoints.push({
                    yearMonth: row.yearMonth,
                    value: row[location]
                });
            }
        });
        
        // データポイントを時系列で並べ替え
        dataPoints.sort((a, b) => {
            return allYearMonths.indexOf(a.yearMonth) - allYearMonths.indexOf(b.yearMonth);
        });
        
        // データがある場合のみデータセットを追加
        if (dataPoints.length > 0) {
            // 表示用のデータを準備
            // allYearMonthsの各要素に対して、dataPointsに一致するデータがあればその値を、なければnullを設定
            const timelineData = allYearMonths.map(yearMonth => {
                const dataPoint = dataPoints.find(dp => dp.yearMonth === yearMonth);
                return dataPoint ? dataPoint.value : null;
            });
            
            // 年ごとに分けるのではなく、地点ごとに1つのデータセットを作成
            const color = colorScheme[location].base;
            const dataset = {
                label: location,
                data: timelineData,
                borderColor: color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: colorScheme[location].dash,
                tension: 0,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false,
                spanGaps: true // データが欠落している箇所は線を引かない
            };
            datasets.push(dataset);
        }
    });
    
    return {
        datasets: datasets,
        labels: allYearMonths
    };
}

// チャート更新
function updateChart() {
    let datasets, labels, title;
    
    if (currentDisplayMode === DISPLAY_MODES.MONTHLY) {
        datasets = createMonthlyDatasets();
        labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        title = '月';
    } else {
        // 時系列表示モードの場合
        const timelineData = createTimelineDatasets();
        datasets = timelineData.datasets;
        labels = timelineData.labels;
        title = '期間';
    }

    if (chart) {
        chart.data.datasets = datasets;
        chart.data.labels = labels;
        chart.options.scales.x.title.text = title;
        chart.update();
    } else {
        initChart(datasets, labels, title);
    }
}

// チャートの初期化
function initChart(datasets, labels, xAxisTitle) {
    const ctx = document.getElementById('chartContainer').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 6,
                    title: {
                        display: true,
                        text: '測定値'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: xAxisTitle || '月'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// 選択されている地点を取得
function getSelectedLocations() {
    return allLocations.filter(location => {
        const id = location.replace(' ', '_');
        const checkbox = document.getElementById(id);
        return checkbox && checkbox.checked;
    });
}

// 選択されている年を取得
function getSelectedYears() {
    return allYears.filter(year => {
        const checkbox = document.getElementById(`year-${year}`);
        return checkbox && checkbox.checked;
    });
}

// 表示モードの切り替え
function toggleDisplayMode() {
    if (currentDisplayMode === DISPLAY_MODES.MONTHLY) {
        currentDisplayMode = DISPLAY_MODES.TIMELINE;
        document.getElementById('toggle-mode-btn').textContent = '月別表示に切り替え';
        document.getElementById('current-mode-text').textContent = '時系列表示モード';
    } else {
        currentDisplayMode = DISPLAY_MODES.MONTHLY;
        document.getElementById('toggle-mode-btn').textContent = '時系列表示に切り替え';
        document.getElementById('current-mode-text').textContent = '月別表示モード';
    }
    updateChart();
}

// チェックボックスのイベント設定
function setupCheckboxEvents() {
    // 親チェックボックスの処理
    document.querySelectorAll('input[data-parent="true"]').forEach(parentCheckbox => {
        parentCheckbox.addEventListener('change', function () {
            const parentId = this.id;
            const childCheckboxes = document.querySelectorAll(`input[data-parent="${parentId}"]`);

            childCheckboxes.forEach(childCheckbox => {
                childCheckbox.checked = this.checked;
            });

            updateChart();
        });
    });

    // 子チェックボックスの処理
    document.querySelectorAll('input[data-parent]').forEach(childCheckbox => {
        if (!childCheckbox.hasAttribute('data-parent-true')) {
            childCheckbox.addEventListener('change', function () {
                const parentId = this.getAttribute('data-parent');
                const parentCheckbox = document.getElementById(parentId);
                const siblingCheckboxes = document.querySelectorAll(`input[data-parent="${parentId}"]`);

                // 親の状態を更新
                if (this.checked) {
                    // 全ての兄弟が選択されているか確認
                    const allChecked = Array.from(siblingCheckboxes).every(sibling => sibling.checked);
                    if (allChecked) {
                        parentCheckbox.checked = true;
                    }
                } else {
                    parentCheckbox.checked = false;
                }

                updateChart();
            });
        }
    });

    // 個別のチェックボックス
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateChart);
    });
    
    // 表示モード切り替えボタンのイベント設定
    document.getElementById('toggle-mode-btn').addEventListener('click', toggleDisplayMode);
}

// 初期化
document.addEventListener('DOMContentLoaded', async function () {
    parsedData = await loadCSVData();
    setupCheckboxEvents();
    updateChart();
});
