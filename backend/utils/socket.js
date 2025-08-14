// Socket utility 
module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Join role-based rooms
    socket.on('join-room', (role) => {
      socket.join(role);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};

