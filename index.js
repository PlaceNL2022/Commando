const express = require('express');
const fs = require('fs');
const ws = require('ws');

const app = express();
const getPixels = require('get-pixels');

const multer = require('multer')
const upload = multer({ dest: `${__dirname}/uploads/` });

const PORT = 3987;

const VALID_COLORS = ['#BE0039', '#FF4500', '#FFA800', '#FFD635', '#00A368', '#00CC78', '#7EED56', '#00756F', '#009EAA', '#2450A4', '#3690EA', '#51E9F4', '#493AC1', '#6A5CFF', '#811E9F', '#B44AC0', '#FF3881', '#FF99AA', '#6D482F', '#9C6926', '#000000', '#898D90', '#D4D7D9', '#FFFFFF'];

var appData = {
    currentMap: 'blank.png',
    mapHistory: [
        { file: 'blank.png', reason: 'Init ^Noah', date: 1648890843309 }
    ]
};
var brandUsage = {};

if (fs.existsSync(`${__dirname}/data.json`)) {
    appData = require(`${__dirname}/data.json`);
}


console.log(`Server starting at port ${PORT}`);
const server = app.listen(PORT);
const wsServer = new ws.Server({ server: server, path: '/api/ws' });

app.use('/maps', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});
app.use('/maps', express.static(`${__dirname}/maps`));
app.use(express.static(`${__dirname}/static`));

app.get('/api/stats', (req, res) => {
    res.json({
        connectionCount: wsServer.clients.size,
        ...appData,
        date: Date.now()
    });
});

app.post('/updateorders', upload.single('image'), async (req, res) => {
    if (!req.body.reason || !req.body.password || req.body.password != process.env.PASSWORD) {
        res.send('Špatné heslo!');
        fs.unlinkSync(req.file.path);
        return;
    }

    if (req.file.mimetype !== 'image/png') {
        res.send('Soubor musí být PNG!');
        fs.unlinkSync(req.file.path);
        return;
    }

    getPixels(req.file.path, 'image/png', function (err, pixels) {
        if (err) {
            res.send('Chyba čtení souboru!');
            console.log(err);
            fs.unlinkSync(req.file.path);
            return
        }

        if (pixels.data.length !== 8000000) {
            res.send('Soubor musí být 2000x1000 pixelů!');
            fs.unlinkSync(req.file.path);
            return;
        }

        for (var i = 0; i < 2000000; i++) {
            const r = pixels.data[i * 4];
            const g = pixels.data[(i * 4) + 1];
            const b = pixels.data[(i * 4) + 2];

            const hex = rgbToHex(r, g, b);
            if (VALID_COLORS.indexOf(hex) === -1) {
                res.send(`Pixel na ${i % 1000}, ${Math.floor(i / 2000)} má špatnou barvu.`);
                fs.unlinkSync(req.file.path);
                return;
            }
        }

        const file = `${Date.now()}.png`;
        fs.copyFileSync(req.file.path, `${__dirname}/maps/${file}`);
        fs.unlinkSync(req.file.path);
        appData.currentMap = file;
        appData.mapHistory.push({
            file,
            reason: req.body.reason,
            date: Date.now()
        })
        wsServer.clients.forEach((client) => client.send(JSON.stringify({ type: 'map', data: file, reason: req.body.reason })));
        fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(appData));
        res.redirect('/');
    });
});

wsServer.on('connection', (socket, req) => {
    var client_ip = req.headers['CF-Connecting-IP'] || req.headers['X-Forwarded-For'] || req.headers['X-Real-IP'] || req.socket.remoteAddress;
    var client_ua = req.headers['user-agent'] || "missing user-agent";
    console.log(`[${new Date().toLocaleString()}] [+] Client connected from '${client_ip}' - '${client_ua}'`);

    socket.on('close', () => {
        console.log(`[${new Date().toLocaleString()}] [-] Client disconnected`);
    });

    socket.on('message', (message) => {
        var data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            socket.send(JSON.stringify({ type: 'error', data: 'Failed to parse message!' }));
            return;
        }

        if (!data.type) {
            socket.send(JSON.stringify({ type: 'error', data: 'Data missing type!' }));
        }

        switch (data.type.toLowerCase()) {
            case "brand":
                const { brand } = data;
                if (
                    brand === undefined ||
                    brand.length < 1 ||
                    brand.length > 32 ||
                    !isAlphaNumeric(brand)
                )
                    return;
                socket.brand = data.brand;
                break;
            case "getmap":
                socket.send(
                    JSON.stringify({
                        type: "map",
                        data: appData.currentMap,
                        reason: null,
                    })
                );
                break;
            case "ping":
                socket.send(JSON.stringify({ type: "pong" }));
                break;
            case "placepixel":
                const { x, y, color } = data;
                if (
                    x === undefined ||
                    y === undefined ||
                    (color === undefined && x < 0) ||
                    x > 1999 ||
                    y < 0 ||
                    y > 1999 ||
                    color < 0 ||
                    color > 32
                )
                    return;
                console.log(
                    `[${new Date().toLocaleString()}] Pixel placed: ${x}, ${y}: ${color}`
                );
                break;
            default:
                socket.send(
                    JSON.stringify({ type: "error", data: "Unknown command!" })
                );
                break;
        }
    });
});

setInterval(() => {
    brandUsage = Array.from(wsServer.clients)
        .map((c) => c.brand)
        .reduce(function (acc, curr) {
            return acc[curr] ? ++acc[curr] : (acc[curr] = 1), acc;
        }, {});
    console.log(brandUsage);
}, 1000);

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function isAlphaNumeric(str) {
    var code, i, len;

    for (i = 0, len = str.length; i < len; i++) {
        code = str.charCodeAt(i);
        if (
            !(code > 47 && code < 58) && // numeric (0-9)
            !(code > 64 && code < 91) && // upper alpha (A-Z)
            !(code > 96 && code < 123)
        ) {
            // lower alpha (a-z)
            return false;
        }
    }
    return true;
}  