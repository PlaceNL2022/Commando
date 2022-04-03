const fs = require('fs');

module.exports = {
    // Log.
    log: (msg) => {
        console.log(`[${new Date().toLocaleString()}] ${msg}`);
    },

    // Error.
    error: (err) => {
        console.error(`[${new Date().toLocaleString()}] ${err}`);
    },

    // Vezme historii map a vybere z nich 5 nejnovějších
    getRecentMaps: (complete) => {
        let recent = JSON.parse(JSON.stringify(complete));
        recent = recent.sort((a, b) => { return b.date - a.date; });
        
        if (recent.length <= 5) return recent;
        return recent.slice(0, 5);
    },

    // Přepočítá RGB na HEX
    rgbToHex: (r, g, b) => {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    },

    // Kontroluje špatný placepixel
    checkIncorrectPlace: (x, y, color) => {
        return (x === undefined || y === undefined || color === undefined && x < 0 || x > 1999 || y < 0 || y > 999 || color < 0 || color > 32);
    },

    // Ukládá appData do data.json
    saveAppdata: (appData) => {
        try {
            fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(appData));
            module.exports.log(`AppData file was saved.`);
        } catch (e) {
            module.exports.error(`Saving AppData failed: ${e}`);
        }
    },

    // Handluje aktualizaci příkazů
    handleUpdateError: (req, res, err) => {
        res.send(err);
        fs.unlinkSync(req.file.path);
        module.exports.error(`UpdateOrders failed: ${err}`);
    },

    // Kouká jestli je věc alfanumerická
    isAlphaNumeric(str) {
        let code, i, len;
    
        for (i = 0, len = str.length; i < len; i++) {
            code = str.charCodeAt(i);
            if (
                !(code > 47 && code < 58) && // numeric (0-9)
                !(code > 64 && code < 91) && // upper alpha (A-Z)
                !(code > 96 && code < 123)
            ) return false; // lower alpha (a-z)
        }

        return true;
    },

    // Kontroluje jestli je v pořádku brand
    checkInvalidBrand(brand) {
        return (brand === undefined || brand.length < 1 || brand.length > 32 || !module.exports.isAlphaNumeric(brand));
    }
};