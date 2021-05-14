const path = require('path');
const app = require('express')();
const http = require('http');
//const http = require('http').Server(app);
const fs = require('fs');
const socketio = require('socket.io')
const rooms = require('./rooms.js')

//const io = require('socket.io')(http);

let httpsServer;
let httpServer;
let io;

const httpsArgs = process.argv.slice(2)

const key = httpsArgs[0]
const cert = httpsArgs[1]
const ca = httpsArgs[2]
let domain = httpsArgs[3]

let totalConnections = 0

const PORT = process.env.PORT || 5000

// testing homepage
app.get('/', (req, res) => {
    res.send('Server up');
});

// create https server if ssl keys are set properly and passed by argument
try {
    if (fs.existsSync(key) && fs.existsSync(cert)) {
        //file exists
        httpsServer = https.createServer({
            key: fs.readFileSync(key, 'utf8'),
            cert: fs.readFileSync(cert, 'utf8'),
            //ca: fs.readFileSync(ca, 'utf8') //hide this if your ssl keys don't include ca
        }, app).listen(443)
        io = socketio(httpsServer)
        console.log('Https server running')
    } else {
        console.log('Something went wrong with SSL certificates, starting http server')
        httpServer = http.createServer(app);
        io = socketio(httpServer)
        httpServer.listen(PORT)
    }
} catch (err) {
    console.error(err)
}

io.on('connection', (socket) => {
    console.log("new websocket connection")

    socket.on('join', (roomName, password) => {
        socket.join(roomName)
        totalConnections++
        const room = rooms.addRoom(roomName, '')

        if(room.password === password){
            room.allowedList.indexOf(socket.id) === -1 ? room.allowedList.push(socket.id) : console.log("This item already exists");
            console.log(room.allowedList)
        }

        socket.to(roomName).emit('datachannel', 'A new user joined the room')
    })

    socket.on('datachannel', (room, data) => {
        const requestedRoom = rooms.findRoomByName(room)
        //if user is in allowed list, send data to others
        if(requestedRoom.allowedList.indexOf(socket.id) !== -1) {
            console.log(room + " " + data)
            if (isJson(data)) {
                console.log(room + " " + JSON.parse(data))
            }
            socket.to(room).emit('datachannel', data)
        }
        else{
            console.log("wrong password")
            io.to(socket).emit('datachannel', "Wrong Password")
        }
    })

    socket.on('disconnecting', () => {
        const ioRooms = Object.keys(socket.rooms);
        const room = rooms.findRoomByName(ioRooms[1])
        rooms.decrementRoomConnection(room)
    });

    socket.on('disconnect', () => {
        io.emit('message', 'A user has left')
    })
})

/*io.use((socket, next) => {
    console.log(socket.request.data)
    next()
    //check wether the user is in the whitelist or not
    if (socket.request.socketRooms(socket.id)){
        room.allowedList.indexOf(socket.id) === -1 ? room.allowedList.push(socket.id) : console.log("This item already exists");

        //password must be stored somewhere in the request and compared
        //with the password stored in the room.
        console.log("Right Password")
        next();
    }
    else{
        console.log("Wrong Password")
        next(new Error("Wrong Password"))
    }
})*/


function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}