const fs = require('fs');
const path = require('path');

const jsonPath = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\dashboard\\shopee_data.json';
const jsPath = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\dashboard\\data.js';

const raw = fs.readFileSync(jsonPath, 'utf-8');
const jsContent = `// Auto-generated Shopee dataset for Khánh Phong Dashboard
window.INITIAL_SHOPEE_DATA = ${raw};
`;

fs.writeFileSync(jsPath, jsContent, 'utf-8');
console.log('Saved data.js successfully!');
