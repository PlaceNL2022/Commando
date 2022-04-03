const express = require('express');
const fs = require('fs');
const ws = require('ws');

const lib = require('./lib.js');
const { randomUUID } = require('crypto');

const app = express();
const getPixels = require('get-pixels');

const multer = require('multer');
const upload = multer({ dest: `${__dirname}/uploads/` });

const COLOR_MAPPINGS = {
    '#BE0039': 1,
    '#FF4500': 2,
    '#FFA800': 3,
    '#FFD635': 4,
    '#00A368': 6,
    '#00CC78': 7,
    '#7EED56': 8,
    '#00756F': 9,
    '#009EAA': 10,
    '#2450A4': 12,
    '#3690EA': 13,
    '#51E9F4': 14,
    '#493AC1': 15,
    '#6A5CFF': 16,
    '#811E9F': 18,
    '#B44AC0': 19,
    '#FF3881': 22,
    '#FF99AA': 23,
    '#6D482F': 24,
    '#9C6926': 25,
    '#000000': 27,
    '#898D90': 29,
    '#D4D7D9': 30,
    '#FFFFFF': 31
};

let appData = {
    currentOrders: [],
    currentMap: 'blank.png',
    mapHistory: [
        { file: 'blank.png', reason: 'Init ^Noah', date: 1648890843309 }
    ],
    pixelsPlaced: 0
};

if (fs.existsSync(`${__dirname}/data.json`)) {
    appData = require(`${__dirname}/data.json`);
}

const server = app.listen(3987);
const wsServer = new ws.Server({ server: server, path: '/api/ws' });

app.use('/maps', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.use('/maps', express.static(`${__dirname}/maps`));
app.use(express.static(`${__dirname}/static`));

let recentHistory = lib.getRecent(appData.mapHistory);

app.get('/api/stats', (req, res) => {
    res.json({
        connectionCount: wsServer.clients.size,
        pixelsPlaced: appData.pixelsPlaced,
        currentMap: appData.currentMap,
        mapHistory: recentHistory,
        date: Date.now()
    });
});

app.get('/api/map', (req, res) => {
    res.json({
        currentMap: appData.currentMap,
        mapHistory: appData.mapHistory,
        date: Date.now()
    });
});

app.get('/api/orders', (req, res) => {
    res.json({
        orders: appData.currentOrders,
        date: Date.now()
    });
});

app.post('/updateorders', upload.single('image'), async (req, res) => {
    if (!req.body?.password || req.body?.password !== process.env.PASSWORD)
        return lib.handleUpdateError(req, res, 'Incorrect password');

    if (req.file.mimetype !== 'image/png') 
        return lib.handleUpdateError(req, res, 'The file must be PNG!');

    getPixels(req.file.path, 'image/png', function (err, pixels) {
        if (err) {
            console.error(err);
            return lib.handleUpdateError(req, res, 'An error occured.');
        }

        if (pixels.data.length !== 8000000)
            return lib.handleUpdateError(req, res, 'The file must be 2000x1000 pixels!');

        let updatedOrders = [];
        for (var i = 0; i < 2000000; i++) {
            const a = pixels.data[(i * 4) + 3];
            if (a !== 255) continue;

            const x = i % 1000, 
                y = Math.floor(i / 2000), 
                r = pixels.data[i * 4],
                g = pixels.data[(i * 4) + 1],
                b = pixels.data[(i * 4) + 2];

            const hex = rgbToHex(r, g, b);
            const color = COLOR_MAPPINGS[hex];

            if (!color) 
                return lib.handleUpdateError(req, res, `A pixel on ${x}, ${y} has a wrong color.<br>R: ${r}, G: ${g}, B: ${b}, A: ${a}`);

            updatedOrders.push([x, y, color]);
        }

        const file = `${Date.now()}.png`;

        fs.copyFileSync(req.file.path, `${__dirname}/maps/${file}`);
        fs.unlinkSync(req.file.path);
        appData.currentOrders = JSON.parse(JSON.stringify(updatedOrders)); // This is bad.
        appData.currentMap = file;
        appData.mapHistory.push({
            file,
            reason: req.body.reason,
            date: Date.now()
        });
        recentHistory = lib.getRecentMaps(appData.mapHistory);

        wsServer.clients.forEach((client) => {
            client.send(JSON.stringify({ type: 'map', data: appData.currentMap, reason: req.body?.reason }));
            client.send(JSON.stringify({ type: 'orders', data: appData.currentOrders, reason: req.body?.reason }));
        });

        lib.saveAppdata(appData);
        res.redirect('/');
    });
});

let pixelsLastPlaced = {};

wsServer.on('connection', (socket) => {
    socket._id = randomUUID().slice(0, 8);
    lib.log(`[+] Client ${socket._id} connected`);

    socket.on('close', () => {
        lib.log(`[-] Client ${socket._id} disconnected`);
    });

    socket.on('message', (message) => {
        let data = {};

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
            case 'getmap':
                socket.send(JSON.stringify({ type: 'map', data: appData.currentMap, reason: null }));
                break;
            case 'getorders':
                socket.send(JSON.stringify({ type: 'orders', data: appData.currentOrders, reason: null }));
                break;
            case 'placepixel':
                const lastPlaced = pixelsLastPlaced[socket._id] != null ? pixelsLastPlaced[socket._id] : 0;
                if (Date.now() - lastPlaced <= 5000) break;

                const { x, y, color } = data;
                if (lib.checkIncorrectPlace(x, y, color)) return;
                lib.log(`Pixel placed by ${id}: ${x}, ${y}: ${color}`);

                pixelsLastPlaced[socket._id] = Date.now();
                appData.pixelsPlaced++;
                break;
            case 'ping':
                socket.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                socket.send(JSON.stringify({ type: 'error', data: 'Unknown command!' }));
                break;
        }
    });
});

setInterval(() => {
    lib.saveAppdata(appData);
}, (15 * 60 * 1000));
