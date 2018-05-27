'use strict';

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var Lupus = require(__dirname + '/lib/lupus');
var adapter = new utils.Adapter('lupusec');
var lupusec = null;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function(callback) {
  try {
    // adapter.log.info('cleaned everything up...');
    callback();
  } catch (e) {
    callback();
  }
});

// is called if a subscribed object changes
adapter.on('objectChange', function(id, obj) {
  // Warning, obj can be null if it was deleted
  // adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function(id, state) {
  // Warning, state can be null if it was deleted
  //  adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

  // you can use the ack flag to detect if it is status (true) or command (false)
  if (state && !state.ack) {

    if (lupusec) {

      const regstatusex = /lupusec\..+\.(.+)\.info.(status_ex|hue|sat)/gm;

      let m = regstatusex.exec(id);

      if (m !== null) {

        let key = m[1]; // Device
        let statusname = m[2]; // statusname
        let status = state.val;
        let values = {};

        if (statusname == "status_ex") {
          if (status === false) {
            status = 0;
          } else {
            status = 1;
          }
          values.switch = status;
        }

        if (statusname == "hue") {
          values.hue = status;
        }

        if (statusname == "sat") {
          values.sat = status;
        }

        lupusec.DeviceSwitchPSSPost(key, values);

      }

      if (id == adapter.namespace + ".Status.mode_pc_a1") {
        lupusec.PanelCondPost(1, state.val);
      }

      if (id == adapter.namespace + ".Status.mode_pc_a2") {
        lupusec.PanelCondPost(2, state.val);
      }

    }

  }

});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function(obj) {
  if (typeof obj === 'object' && obj.message) {
    if (obj.command === 'send') {
      // e.g. send email or pushover or whatever
      // console.log('send command');

      // Send response in callback if required
      if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    }
  }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function() {
  main();
});

function main() {

  lupusec = new Lupus(adapter);

  if (adapter.config.alarm_host != null && adapter.config.alarm_host != "") {

    lupusec.DeviceListGet();
    lupusec.DevicePSSListGet();
    lupusec.PanelCondGet();
    lupusec.DeviceEditAllGet();

    adapter.subscribeStates(adapter.namespace + ".*.info.status_ex");
    adapter.subscribeStates(adapter.namespace + ".*.info.hue");
    adapter.subscribeStates(adapter.namespace + ".*.info.sat");
    adapter.subscribeStates(adapter.namespace + ".Status.mode_pc_a1");
    adapter.subscribeStates(adapter.namespace + ".Status.mode_pc_a2");

  }


}
