
import PomeloClient from '../lib/main'

const client = new PomeloClient()

function queryEntry(uid: any, callback: Function) {
  var route = 'gate.gateHandler.queryEntry';
  client.init({
    host: window.location.hostname,
    port: 3014,
    log: true,
  }, function () {
    client.request(route, {
      uid: uid
    }, function (data: any) {
      client.disconnect();
      if (data.code === 500) {
        return;
      }
      callback(data.host, data.port);
    });
  });
};


queryEntry('uid', function (host: string, port: string | number) {
  client.init({
    host: host,
    port: port,
    log: true
  }, function () {
    var route = "connector.entryHandler.enter";
    client.request(route, {
      username: 'username',
      rid: 'rid-1'
    }, function (data: any) {
      if (data.error) {
        console.log('request error')
        return;
      }
      console.log(data)
      console.log('success request')
    });
  });
});

