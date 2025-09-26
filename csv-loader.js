/**
 * CSV Loader for HubSpot Email Dashboard
 * This script loads and processes the CSV data directly in the browser
 */

// Status categories
const STATUS_CATEGORIES = [
    'New Asset in Workflow',
    'Old Asset - Live', 
    'QA Ready - Old Asset Updated',
    'In Progress',
    'Retired',
    'No Update Needed',
    'Not Created'
];

/**
 * Clean and normalize status values
 */
function cleanStatus(status) {
    if (!status || status.trim() === '') {
        return 'Not Created';
    }
    
    status = status.trim();
    
    // Map various status values to standard categories
    const statusMapping = {
        'New Asset in Workflow': 'New Asset in Workflow',
        'Old Asset - Live': 'Old Asset - Live',
        'QA Ready - Old Asset Updated': 'QA Ready - Old Asset Updated',
        'In Progress': 'In Progress',
        'Retired': 'Retired',
        'No Update Needed': 'No Update Needed',
        'Not Created': 'Not Created'
    };
    
    return statusMapping[status] || 'Not Created';
}

/**
 * Clean and normalize language values
 */
function cleanLanguage(language) {
    if (!language || language.trim() === '') {
        return 'Unknown';
    }
    
    language = language.trim();
    
    // Filter out non-language entries
    if (language.includes('Backfill TBD') || 
        language.includes('(Backfill TBD)') || 
        language.includes('Kelsey Craddock')) {
        return null; // Skip these entries
    }
    
    // Clean up any quotes or special characters
    language = language.replace(/^["']|["']$/g, '');
    
    return language;
}

/**
 * Clean and normalize priority values
 */
function cleanPriority(priority) {
    if (!priority || priority.trim() === '') {
        return 'Unassigned';
    }
    
    return priority.trim();
}

/**
 * Parse CSV text into structured data
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const data = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parsing - split by comma and handle quotes
        const row = parseCSVRow(line);
        
        if (row.length >= 11) {
            data.push({
                language: cleanLanguage(row[0]),
                priority: cleanPriority(row[1]),
                status: cleanStatus(row[10])
            });
        }
    }
    
    return data;
}

/**
 * Parse CSV text, handling multi-line fields and quoted content
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const data = [];
    let currentRow = '';
    let inQuotes = false;
    let quoteCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Count quotes in the line
        const lineQuoteCount = (line.match(/"/g) || []).length;
        quoteCount += lineQuoteCount;
        
        if (currentRow === '') {
            currentRow = line;
        } else {
            currentRow += '\n' + line;
        }
        
        // If we have an even number of quotes, we've completed a row
        if (quoteCount % 2 === 0) {
            if (currentRow.trim()) {
                const row = parseCSVRow(currentRow);
                if (row.length >= 11) {
                    const language = cleanLanguage(row[0]);
                    // Only include rows with valid languages
                    if (language && language !== 'Unknown') {
                        data.push({
                            language: language,
                            priority: cleanPriority(row[1]),
                            status: cleanStatus(row[10])
                        });
                    }
                }
            }
            currentRow = '';
            quoteCount = 0;
        }
    }
    
    return data;
}

/**
 * Parse a single CSV row, handling quoted fields
 */
function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

/**
 * Calculate percentage
 */
function calculatePercentage(count, total) {
    if (total === 0) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
}

/**
 * Process data and return dashboard statistics
 */
function processData(data) {
    const totalEmails = data.length;
    
    // Calculate language stats
    const languageStats = {};
    data.forEach(row => {
        if (!languageStats[row.language]) {
            languageStats[row.language] = { total: 0, statuses: {} };
        }
        languageStats[row.language].total++;
        languageStats[row.language].statuses[row.status] = 
            (languageStats[row.language].statuses[row.status] || 0) + 1;
    });
    
    // Calculate priority stats
    const priorityStats = {};
    data.forEach(row => {
        if (!priorityStats[row.priority]) {
            priorityStats[row.priority] = { total: 0, statuses: {} };
        }
        priorityStats[row.priority].total++;
        priorityStats[row.priority].statuses[row.status] = 
            (priorityStats[row.priority].statuses[row.status] || 0) + 1;
    });
    
    // Calculate status counts
    const statusCounts = {};
    STATUS_CATEGORIES.forEach(status => statusCounts[status] = 0);
    data.forEach(row => {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    });
    
    // Sort priorities numerically
    const sortedPriorities = Object.keys(priorityStats).sort((a, b) => {
        const aNum = parseInt(a.replace(/\D/g, '')) || 999;
        const bNum = parseInt(b.replace(/\D/g, '')) || 999;
        return aNum - bNum;
    });
    
    // Sort languages by count (descending)
    const sortedLanguages = Object.keys(languageStats).sort((a, b) => 
        languageStats[b].total - languageStats[a].total
    );
    
    return {
        totalEmails,
        statusCategories: STATUS_CATEGORIES,
        statusCounts,
        languageStats,
        priorityStats,
        sortedLanguages,
        sortedPriorities,
        generatedAt: new Date().toISOString()
    };
}

/**
 * Load CSV file and return processed data
 */
async function loadCSVData(filename = 'HubSpot Email Template Rebrand _ List of Emails to be Updated - Emails To Be Updated.csv') {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const rawData = parseCSV(csvText);
        const processedData = processData(rawData);
        
        console.log(`✅ Loaded ${processedData.totalEmails} emails from CSV`);
        return processedData;
        
    } catch (error) {
        console.error('Error loading CSV:', error);
        throw error;
    }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadCSVData,
        parseCSV,
        processData,
        cleanStatus,
        cleanLanguage,
        cleanPriority,
        calculatePercentage,
        STATUS_CATEGORIES
    };
}
