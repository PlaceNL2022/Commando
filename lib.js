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
            this.log(`AppData file was saved.`);
        } catch (e) {
            this.error(`Saving AppData failed: ${err}`);
        }
    },

    handleUpdateError: (req, res, err) => {
        res.send(err);
        fs.unlinkSync(req.file.path);
        this.error(`UpdateOrders failed: ${err}`);
    }
};