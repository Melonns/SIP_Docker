import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from './api/axiosConfig';

window.Pusher = Pusher;

const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;
const pusherCluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;

let echo = null;

if (pusherKey) {
  echo = new Echo({
    broadcaster: 'pusher',
    key: pusherKey,
    cluster: pusherCluster,
    forceTLS: true,
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        axios.post('/broadcasting/auth', {
          socket_id: socketId,
          channel_name: channel.name,
        })
        .then(res => callback(false, res.data))
        .catch(err => {
          console.error('[Echo] Auth failed for channel', channel.name, err);
          callback(true, err);
        });
      }
    }),
  });
} else {
  console.warn('[Echo] Pusher key is missing. Real-time notifications are disabled.');
  // Provide a dummy object to prevent crashes in components that call Echo methods
  echo = {
    private: () => ({ notification: () => {} }),
    channel: () => ({ listen: () => {} }),
    leave: () => {},
    leaveChannel: () => {},
  };
}

export default echo;
